import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as events from "aws-cdk-lib/aws-events";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";

export interface SchedulingStackProps extends cdk.StackProps {
  shipmentsTable: dynamodb.Table;
  agentRuntimeRole: iam.Role;
}

/**
 * Drives the Track-and-Trace Agent's polling loop.
 *
 * PHASE 4 TODO: wire the rule's target to the deployed AgentCore endpoint
 * (or a Step Functions state machine for the multi-step check-in flow) once
 * the Track-and-Trace Agent exists.
 */
export class SchedulingStack extends cdk.Stack {
  public readonly trackAndTraceRule: events.Rule;

  constructor(scope: Construct, id: string, props: SchedulingStackProps) {
    super(scope, id, props);

    this.trackAndTraceRule = new events.Rule(this, "TrackAndTracePoll", {
      ruleName: "manifest-track-and-trace-poll",
      description: "Triggers the Track-and-Trace Agent to check every active shipment's status.",
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
      enabled: false,
    });
  }
}
