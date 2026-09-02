import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";

/**
 * Core persistence layer: shipment/load/carrier state in DynamoDB,
 * documents and cargo photos in S3.
 */
export class DataStack extends cdk.Stack {
  public readonly loadsTable: dynamodb.Table;
  public readonly carriersTable: dynamodb.Table;
  public readonly shipmentsTable: dynamodb.Table;
  public readonly rateHistoryTable: dynamodb.Table;
  public readonly auditLogTable: dynamodb.Table;
  public readonly documentsBucket: s3.Bucket;
  public readonly photosBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.loadsTable = new dynamodb.Table(this, "LoadsTable", {
      tableName: "manifest-loads",
      partitionKey: { name: "loadId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.loadsTable.addGlobalSecondaryIndex({
      indexName: "byLane",
      partitionKey: { name: "lane", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "postedAt", type: dynamodb.AttributeType.STRING },
    });

    this.carriersTable = new dynamodb.Table(this, "CarriersTable", {
      tableName: "manifest-carriers",
      partitionKey: { name: "mcNumber", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.shipmentsTable = new dynamodb.Table(this, "ShipmentsTable", {
      tableName: "manifest-shipments",
      partitionKey: { name: "shipmentId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "eventTimestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.shipmentsTable.addGlobalSecondaryIndex({
      indexName: "byStatus",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "expectedDelivery", type: dynamodb.AttributeType.STRING },
    });

    this.rateHistoryTable = new dynamodb.Table(this, "RateHistoryTable", {
      tableName: "manifest-rate-history",
      partitionKey: { name: "lane", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "bookedAt", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.auditLogTable = new dynamodb.Table(this, "AuditLogTable", {
      tableName: "manifest-audit-log",
      partitionKey: { name: "entityId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "eventTimestamp", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.auditLogTable.addGlobalSecondaryIndex({
      indexName: "byAgent",
      partitionKey: { name: "agentName", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "eventTimestamp", type: dynamodb.AttributeType.STRING },
    });

    this.documentsBucket = new s3.Bucket(this, "DocumentsBucket", {
      bucketName: `manifest-documents-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.photosBucket = new s3.Bucket(this, "PhotosBucket", {
      bucketName: `manifest-cargo-photos-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
