import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as triggers from 'aws-cdk-lib/triggers';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';

interface ComputeStackProps extends cdk.StackProps {
    ingestTable: dynamodb.TableV2;
    apiSecret: secretsmanager.Secret;
    sharedLogGroup: logs.LogGroup;
}

export class ComputeStack extends cdk.Stack {
    public readonly ingestLambda: lambdaNodejs.NodejsFunction;

    constructor(scope: Construct, id: string, props: ComputeStackProps) {
        super(scope, id, props);

        this.ingestLambda = new lambdaNodejs.NodejsFunction(this, 'IngestLambdaHandler', {
            entry: path.join(__dirname, '../src/lambdas/ingest.ts'),
            handler: 'handler',
            timeout: cdk.Duration.minutes(14),
            environment: {
                TABLE_NAME: props.ingestTable.tableName,
                SECRET_ARN: props.apiSecret.secretArn,
            },
            logGroup: props.sharedLogGroup,
        });

        props.ingestTable.grantReadWriteData(this.ingestLambda);
        props.apiSecret.grantRead(this.ingestLambda);

        //run weekdays at 22:00 UTC which should be plenty of time after market close
        //the function has logic to ensure only valid market dates are stored but better to not run too often
        const dailyCronRule = new events.Rule(this, 'DailyIngestCron', {
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '22',
                weekDay: 'MON-FRI'
            }),
        });

        dailyCronRule.addTarget(new targets.LambdaFunction(this.ingestLambda));
    }
}