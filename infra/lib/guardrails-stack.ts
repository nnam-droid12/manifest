import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as bedrock from "aws-cdk-lib/aws-bedrock";

/**
 * Bedrock Guardrails enforced on the Carrier Outreach Agent so it can
 * never commit to a rate outside its authorized ceiling, quote unauthorized
 * accessorials, or make a binding statement the broker hasn't approved.
 */
export class GuardrailsStack extends cdk.Stack {
  public readonly carrierOutreachGuardrail: bedrock.CfnGuardrail;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.carrierOutreachGuardrail = new bedrock.CfnGuardrail(this, "CarrierOutreachGuardrail", {
      name: "manifest-carrier-outreach-guardrail",
      description:
        "Blocks the Carrier Outreach Agent from committing to rates outside its authorized " +
        "range or making binding statements not approved by the broker.",
      blockedInputMessaging:
        "This request falls outside what I'm authorized to negotiate. Escalating to the broker.",
      blockedOutputsMessaging:
        "I can't send that message — it would commit to terms outside my authorized negotiation range.",
      topicPolicyConfig: {
        topicsConfig: [
          {
            name: "UnauthorizedCommitments",
            definition:
              "Agreeing to a final rate, accessorial charge, or contractual term that has not " +
              "been explicitly authorized by the broker for this load.",
            examples: [
              "I can confirm $4,500 for this load even though my ceiling is $3,800.",
              "Yes, we'll cover detention pay with no limit.",
              "Consider this a signed agreement.",
            ],
            type: "DENY",
          },
        ],
      },
      wordPolicyConfig: {
        managedWordListsConfig: [{ type: "PROFANITY" }],
      },
      sensitiveInformationPolicyConfig: {
        piiEntitiesConfig: [
          { type: "US_BANK_ACCOUNT_NUMBER", action: "BLOCK" },
          { type: "US_SOCIAL_SECURITY_NUMBER", action: "BLOCK" },
          { type: "CREDIT_DEBIT_CARD_NUMBER", action: "BLOCK" },
        ],
      },
    });

    new bedrock.CfnGuardrailVersion(this, "CarrierOutreachGuardrailVersion", {
      guardrailIdentifier: this.carrierOutreachGuardrail.attrGuardrailId,
      description: "Initial published version",
    });
  }
}
