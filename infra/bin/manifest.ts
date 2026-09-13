#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { AuthStack } from "../lib/auth-stack";
import { GuardrailsStack } from "../lib/guardrails-stack";
import { AgentRuntimeStack } from "../lib/agent-runtime-stack";
import { KnowledgeBaseStack } from "../lib/knowledge-base-stack";
import { SchedulingStack } from "../lib/scheduling-stack";
import { DashboardHostingStack } from "../lib/dashboard-hosting-stack";
import { BrowserAgentStack } from "../lib/browser-agent-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

const tags = { project: "manifest" };

const data = new DataStack(app, "Manifest-Data", { env, tags });
const auth = new AuthStack(app, "Manifest-Auth", { env, tags });
const guardrails = new GuardrailsStack(app, "Manifest-Guardrails", { env, tags });

const knowledgeBase = new KnowledgeBaseStack(app, "Manifest-KnowledgeBase", {
  env,
  tags,
  documentsBucket: data.documentsBucket,
});

const agentRuntime = new AgentRuntimeStack(app, "Manifest-AgentRuntime", {
  env,
  tags,
  loadsTable: data.loadsTable,
  carriersTable: data.carriersTable,
  shipmentsTable: data.shipmentsTable,
  rateHistoryTable: data.rateHistoryTable,
  auditLogTable: data.auditLogTable,
  documentsBucket: data.documentsBucket,
  photosBucket: data.photosBucket,
  outreachGuardrailId: guardrails.carrierOutreachGuardrail.attrGuardrailId,
});

new SchedulingStack(app, "Manifest-Scheduling", {
  env,
  tags,
  shipmentsTable: data.shipmentsTable,
  agentRuntimeRole: agentRuntime.agentExecutionRole,
});

new DashboardHostingStack(app, "Manifest-Dashboard", {
  env,
  tags,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});

new BrowserAgentStack(app, "Manifest-BrowserAgent", { env, tags });
