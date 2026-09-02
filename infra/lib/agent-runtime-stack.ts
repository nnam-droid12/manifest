import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface AgentRuntimeStackProps extends cdk.StackProps {
  loadsTable: dynamodb.Table;
  carriersTable: dynamodb.Table;
  shipmentsTable: dynamodb.Table;
  rateHistoryTable: dynamodb.Table;
  auditLogTable: dynamodb.Table;
  documentsBucket: s3.Bucket;
  photosBucket: s3.Bucket;
  outreachGuardrailId: string;
}

/**
 * Execution role and permission boundary for the Manifest agent swarm.
 *
 * PHASE 6 TODO: provision the actual Bedrock AgentCore Runtime resource(s)
 * (one per agent, or one shared runtime hosting the Strands multi-agent
 * app), AgentCore Memory for per-shipment state, and AgentCore
 * Gateway/Identity fronting the browser-automation, email, and voice tools.
 * This stack currently defines the IAM role those resources will assume so
 * the permission surface is reviewable independently of the runtime
 * resources landing.
 */
export class AgentRuntimeStack extends cdk.Stack {
  public readonly agentExecutionRole: iam.Role;

  constructor(scope: Construct, id: string, props: AgentRuntimeStackProps) {
    super(scope, id, props);

    this.agentExecutionRole = new iam.Role(this, "AgentExecutionRole", {
      roleName: "manifest-agent-execution-role",
      assumedBy: new iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
      description: "Execution role assumed by the Manifest agent swarm running on Bedrock AgentCore.",
    });

    props.loadsTable.grantReadWriteData(this.agentExecutionRole);
    props.carriersTable.grantReadWriteData(this.agentExecutionRole);
    props.shipmentsTable.grantReadWriteData(this.agentExecutionRole);
    props.rateHistoryTable.grantReadWriteData(this.agentExecutionRole);
    props.auditLogTable.grantWriteData(this.agentExecutionRole);
    props.documentsBucket.grantReadWrite(this.agentExecutionRole);
    props.photosBucket.grantReadWrite(this.agentExecutionRole);

    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "BedrockModelInvocation",
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: ["*"],
      })
    );

    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "BedrockGuardrails",
        actions: ["bedrock:ApplyGuardrail"],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:guardrail/${props.outreachGuardrailId}`,
        ],
      })
    );

    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "BedrockKnowledgeBaseRetrieval",
        actions: ["bedrock:Retrieve", "bedrock:RetrieveAndGenerate"],
        resources: ["*"],
      })
    );

    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DocumentExtraction",
        actions: [
          "textract:AnalyzeDocument",
          "textract:AnalyzeExpense",
          "textract:DetectDocumentText",
        ],
        resources: ["*"],
      })
    );

    this.agentExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "VoiceChannel",
        actions: [
          "connect:StartOutboundVoiceContact",
          "connect:StopContact",
          "polly:SynthesizeSpeech",
          "transcribe:StartStreamTranscription",
        ],
        resources: ["*"],
      })
    );
  }
}
