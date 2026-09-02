import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

export interface KnowledgeBaseStackProps extends cdk.StackProps {
  documentsBucket: s3.Bucket;
}

/**
 * Backing store for the Playbook & Lane-History Agent's Bedrock Knowledge Base
 * (broker playbook notes, historical loads, carrier relationship notes).
 *
 * PHASE 5 TODO: provision the OpenSearch Serverless vector collection and the
 * bedrock.CfnKnowledgeBase / CfnDataSource resources pointing at this bucket,
 * once real playbook content exists to index.
 */
export class KnowledgeBaseStack extends cdk.Stack {
  public readonly playbookBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: KnowledgeBaseStackProps) {
    super(scope, id, props);

    this.playbookBucket = new s3.Bucket(this, "PlaybookSourceBucket", {
      bucketName: `manifest-playbook-source-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new s3deploy.BucketDeployment(this, "SeedPlaybookNotes", {
      sources: [s3deploy.Source.asset("../seed-data/playbook")],
      destinationBucket: this.playbookBucket,
    });
  }
}
