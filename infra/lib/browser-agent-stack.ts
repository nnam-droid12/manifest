import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

/**
 * Backs the dashboard's "agent opens a real browser" hero interaction.
 *
 * Bedrock AgentCore's Browser Tool (a real, isolated, AWS-managed Chromium
 * instance with a live-view stream) works fine with normal IAM credentials,
 * but every attempt to call it from a Cognito guest/federated identity gets
 * AccessDeniedException at the account level -- confirmed by testing (see
 * commit history). So this Lambda, running under its own execution role
 * (not federated), starts the session and generates the SigV4-presigned
 * live-view URL server-side; the dashboard just embeds the URL it's handed
 * back.
 */
export class BrowserAgentStack extends cdk.Stack {
  public readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new nodejs.NodejsFunction(this, "BrowserAgentFunction", {
      entry: path.join(__dirname, "..", "lambda", "browser-agent", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(45),
      memorySize: 512,
      // Wanted reservedConcurrentExecutions here as a cost/abuse ceiling for
      // this Function URL (no auth -- a static-hosted SPA has no backend to
      // hold a real secret), but this account's total Lambda concurrency
      // pool is too small to reserve any without breaching the required
      // 10-unreserved minimum for every other function. The account-wide
      // limit is the real ceiling instead. Each session still self-expires
      // after 5 minutes regardless of what the caller does.
      bundling: {
        format: nodejs.OutputFormat.CJS,
        target: "node20",
        // playwright-core dynamically requires chromium-bidi (an alternative
        // to the CDP path we actually use to talk to the remote AgentCore
        // browser) -- esbuild can't statically resolve it, and we never hit
        // that code path since we only ever connect over CDP.
        externalModules: ["chromium-bidi", "chromium-bidi/*"],
        // playwright-core reads its own package.json (relative to its real
        // file location) to report its version -- esbuild inlining it into
        // one flat file breaks that lookup ("Cannot find module
        // '/var/package.json'"). Installing it as a real, unbundled
        // dependency alongside the bundle keeps its directory structure
        // (package.json included) intact.
        nodeModules: ["playwright-core"],
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock-agentcore:StartBrowserSession",
          "bedrock-agentcore:StopBrowserSession",
          "bedrock-agentcore:GetBrowserSession",
          "bedrock-agentcore:ConnectBrowserAutomationStream",
          "bedrock-agentcore:ConnectBrowserLiveViewStream",
        ],
        resources: ["*"],
      })
    );

    // For the "investigate a real price" flow: screenshot a page the remote
    // browser navigated to, then read whatever text (including prices) is
    // actually visible in it via real Amazon Rekognition OCR.
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectText"],
        resources: ["*"],
      })
    );

    // Pull the product being asked about out of a spoken request ("open
    // amazon with a ring camera" -> "ring camera") via real Comprehend POS
    // tagging, and speak the final price-comparison verdict aloud via real
    // Polly neural TTS.
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["comprehend:DetectSyntax", "polly:SynthesizeSpeech"],
        resources: ["*"],
      })
    );

    this.functionUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["content-type"],
      },
    });

    new cdk.CfnOutput(this, "BrowserAgentFunctionUrl", { value: this.functionUrl.url });
  }
}
