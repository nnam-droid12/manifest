import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";

export interface DashboardHostingStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

/**
 * Static hosting for the broker dashboard.
 *
 * PHASE 7 TODO: this assumes the Next.js app is exported as a static bundle
 * uploaded to `siteBucket`. If the dashboard ends up needing server-side
 * rendering, swap this stack for an AWS Amplify Hosting app instead.
 */
export class DashboardHostingStack extends cdk.Stack {
  public readonly siteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DashboardHostingStackProps) {
    super(scope, id, props);

    this.siteBucket = new s3.Bucket(this, "DashboardSiteBucket", {
      bucketName: `manifest-dashboard-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const cleanUrlRewrite = new cloudfront.Function(this, "CleanUrlRewrite", {
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          if (uri.endsWith("/")) {
            request.uri = uri + "index.html";
          } else if (!uri.includes(".")) {
            request.uri = uri + ".html";
          }
          return request;
        }
      `),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    this.distribution = new cloudfront.Distribution(this, "DashboardDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          { function: cleanUrlRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    new cdk.CfnOutput(this, "DashboardUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: props.userPool.userPoolId });
    new cdk.CfnOutput(this, "CognitoUserPoolClientId", {
      value: props.userPoolClient.userPoolClientId,
    });
  }
}
