import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  ingestTable: dynamodb.TableV2;
  sharedLogGroup: logs.LogGroup;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const getMoversLambda = new lambdaNodejs.NodejsFunction(this, 'GetMoversLambda', {
        entry: path.join(__dirname, '../src/lambdas/get-movers.ts'),
        environment: {
            TABLE_NAME: props.ingestTable.tableName,
        },
        logGroup: props.sharedLogGroup,
    });

    props.ingestTable.grantReadData(getMoversLambda);

    const api = new apigateway.RestApi(this, 'MarketDataApi', {
        restApiName: "PNMAC Data Service",
        description: 'Public API for frontend consumption.',
        defaultCorsPreflightOptions: {
            allowOrigins: apigateway.Cors.ALL_ORIGINS,
            allowMethods: apigateway.Cors.ALL_METHODS,
        },
    });

    const moversResource = api.root.addResource('movers');
    moversResource.addMethod('GET', new apigateway.LambdaIntegration(getMoversLambda));

    new cdk.CfnOutput(this, 'ApiEndpointUrl', {
        value: api.url,
        description: "Root URL for API Gateway",
    })
  }
}