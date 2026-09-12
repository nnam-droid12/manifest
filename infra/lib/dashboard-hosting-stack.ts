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
  public readonly websiteBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DashboardHostingStackProps) {
    super(scope, id, props);

    this.siteBucket = new s3.Bucket(this, "DashboardSiteBucket", {
      bucketName: `manifest-dashboard-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // A second, public-read bucket purely so the dashboard has a URL that
    // literally contains "manifest" — S3's website-hosting endpoint format
    // is http://<bucket-name>.s3-website-<region>.amazonaws.com, and
    // "manifest-dashboard" (unlike the CloudFront distribution's random
    // subdomain, or the primary bucket above, which needs the account ID
    // suffix for global-namespace uniqueness) was available unqualified.
    // HTTP only, no CDN — CloudFront + Cognito above stays the primary,
    // secure entry point; this is a memorable-URL mirror of the same build.
    //
    // Plain S3 website hosting has no URI-rewrite feature (unlike the
    // CloudFront Function below, which appends ".html" to every extensionless
    // request before the origin fetch even happens) — a request for
    // "/dashboard" only resolves if an object literally named "dashboard"
    // exists. Without a fix, that 404s and falls back to the error document
    // (the landing page), so a direct hard-load of a deep link shows the
    // wrong page. Explicit routing rules close that gap for this app's known,
    // finite set of clean-URL routes.
    const cleanUrlRoutes = ["dashboard", "dispatch", "tracking", "cargo", "audit", "approvals", "analytics", "login"];
    this.websiteBucket = new s3.Bucket(this, "DashboardWebsiteBucket", {
      bucketName: "manifest-freight-dashboard",
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      websiteRoutingRules: cleanUrlRoutes.map((route) => ({
        condition: { httpErrorCodeReturnedEquals: "404", keyPrefixEquals: route },
        replaceKey: s3.ReplaceKey.with(`${route}.html`),
      })),
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
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
    new cdk.CfnOutput(this, "DashboardWebsiteUrl", {
      value: this.websiteBucket.bucketWebsiteUrl,
    });
    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: props.userPool.userPoolId });
    new cdk.CfnOutput(this, "CognitoUserPoolClientId", {
      value: props.userPoolClient.userPoolClientId,
    });
  }
}
