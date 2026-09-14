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
 * S3 website-hosting endpoints are HTTP-only -- there's no way to attach a
 * TLS certificate to one directly. That was fine as a "just view the demo"
 * URL, but the Web Speech API (and getUserMedia generally) only grants mic
 * access in a secure context, so Live Investigation's voice input silently
 * refuses to work under plain S3 hosting, on any origin other than
 * localhost. CloudFront in front of the same bucket is the fix: it's the
 * only piece here that can terminate HTTPS. It points at the bucket's
 * *website* endpoint (HttpOrigin, not the S3/OAC origin type) specifically
 * so the bucket's own websiteRoutingRules below keep handling clean-URL
 * routing -- no CloudFront Function needed for that anymore.
 */
export class DashboardHostingStack extends cdk.Stack {
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

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
    // websiteRoutingRules deliberately left off the L2 construct props --
    // see the CfnBucket override below, right after the distribution is
    // created, for why.
    this.websiteBucket = new s3.Bucket(this, "DashboardWebsiteBucket", {
      bucketName: "manifest-freight-dashboard",
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Caching disabled deliberately: this site redeploys constantly during
    // active development, and a stale cached response after every
    // `aws s3 sync` would look like a broken deploy rather than a cache hit.
    // Worth revisiting (a short TTL, or invalidations on deploy) once the
    // site stabilizes.
    this.distribution = new cloudfront.Distribution(this, "DashboardDistribution", {
      defaultBehavior: {
        origin: new origins.HttpOrigin(this.websiteBucket.bucketWebsiteDomainName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
    });

    // S3's own routing-rule redirects always emit an absolute Location built
    // from the bucket's *own* HTTP website hostname, with no way to make it
    // relative -- set via the plain s3.Bucket construct props, every one of
    // these clean-URL redirects would silently drop a visitor out of HTTPS
    // right after they landed (e.g. clicking "Live Investigation" in the
    // sidebar, which links to /investigate, not /investigate.html). Setting
    // Protocol/HostName here points the redirect back through CloudFront
    // instead.
    //
    // The domain is a literal, not `this.distribution.distributionDomainName`
    // -- referencing the distribution's own attribute from inside the
    // bucket's properties makes the bucket depend on the distribution via
    // Fn::GetAtt, while the distribution's origin already depends on the
    // bucket's name, so CloudFormation reports a real circular dependency
    // and refuses to deploy. A CloudFront distribution's domain name is
    // stable for its lifetime once created, so hardcoding the already-known
    // value is safe; it only needs updating if this distribution is ever
    // destroyed and recreated from scratch (a new random subdomain).
    const cfnBucket = this.websiteBucket.node.defaultChild as s3.CfnBucket;
    cfnBucket.addPropertyOverride(
      "WebsiteConfiguration.RoutingRules",
      cleanUrlRoutes.map((route) => ({
        RoutingRuleCondition: { HttpErrorCodeReturnedEquals: "404", KeyPrefixEquals: route },
        RedirectRule: {
          Protocol: "https",
          HostName: "d3lssmt1g7vadl.cloudfront.net",
          ReplaceKeyWith: `${route}.html`,
        },
      }))
    );

    new cdk.CfnOutput(this, "DashboardHttpsUrl", {
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
