import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';

export class BaseStack extends cdk.Stack {
    public readonly ingestTable: dynamodb.TableV2;
    public readonly apiSecret: secretsmanager.Secret;
    public readonly sharedLogGroup: logs.LogGroup;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.ingestTable = new dynamodb.TableV2(this, 'IngestTable', {
            partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        });

        const stage = this.node.tryGetContext('stage') || 'prod';

        this.apiSecret = new secretsmanager.Secret(this, 'ExternalApiSecret', {
            secretName: `ingest/massive-api-key-${stage}`,
            description: `API key for stock data ingest from Massive (${stage})`,
        });

        this.sharedLogGroup = new logs.LogGroup(this, 'SharedLambdaLogs', {
            logGroupName: `/aws/lambda/pnmac-backend-${stage}`,
            retention: logs.RetentionDays.TWO_WEEKS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        new cdk.CfnOutput(this, 'DynamoDbTableName', { value: this.ingestTable.tableName });
        new cdk.CfnOutput(this, 'SecretArn', { value: this.apiSecret.secretArn });
    }
}
