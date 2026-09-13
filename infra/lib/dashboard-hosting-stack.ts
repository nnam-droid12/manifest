import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cognito from "aws-cdk-lib/aws-cognito";

export interface DashboardHostingStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

/**
 * Static hosting for the broker dashboard — plain S3 website hosting only.
 *
 * This used to also run a CloudFront distribution (HTTPS, OAC-fronted
 * private bucket, a CloudFront Function for clean-URL rewriting) as the
 * primary entry point, with this S3 website bucket as a secondary,
 * memorable-URL mirror. Removed at the user's request to keep a single,
 * simpler S3-only deployment target rather than maintaining two live URLs.
 */
export class DashboardHostingStack extends cdk.Stack {
  public readonly websiteBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DashboardHostingStackProps) {
    super(scope, id, props);

    // Plain S3 website hosting has no URI-rewrite feature -- a request for
    // "/dashboard" only resolves if an object literally named "dashboard"
    // exists. Without a fix, that 404s and falls back to the error document
    // (the landing page), so a direct hard-load of a deep link shows the
    // wrong page. Explicit routing rules close that gap for this app's known,
    // finite set of clean-URL routes.
    const cleanUrlRoutes = [
      "dashboard",
      "dispatch",
      "tracking",
      "guardrails",
      "investigate",
      "cargo",
      "audit",
      "approvals",
      "analytics",
      "login",
    ];
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

    new cdk.CfnOutput(this, "DashboardWebsiteUrl", {
      value: this.websiteBucket.bucketWebsiteUrl,
    });
    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: props.userPool.userPoolId });
    new cdk.CfnOutput(this, "CognitoUserPoolClientId", {
      value: props.userPoolClient.userPoolClientId,
    });
  }
}
