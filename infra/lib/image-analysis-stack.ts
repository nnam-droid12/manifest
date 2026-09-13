import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

/**
 * Backs the Cargo Inspector's real photo analysis: a broker uploads their
 * own pickup/delivery photos, this Lambda runs them through real Amazon
 * Rekognition (DetectLabels), and the dashboard renders whatever it
 * genuinely finds -- not a fixed pair of demo images with a canned verdict.
 */
export class ImageAnalysisStack extends cdk.Stack {
  public readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fn = new nodejs.NodejsFunction(this, "ImageAnalysisFunction", {
      entry: path.join(__dirname, "..", "lambda", "image-analysis", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(15),
      memorySize: 512,
      bundling: { format: nodejs.OutputFormat.CJS, target: "node20" },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectLabels"],
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

    new cdk.CfnOutput(this, "ImageAnalysisFunctionUrl", { value: this.functionUrl.url });
  }
}
