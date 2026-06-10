import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BaseStack } from '../lib/base-stack';
import { FrontendStack } from '../lib/frontend-stack';

describe('CDK Infrastructure Stacks', () => {
    it('BaseStack creates DynamoDB Table and Secrets Manager Secret', () => {
        const app = new cdk.App();
        const stack = new BaseStack(app, 'TestBaseStack');
        const template = Template.fromStack(stack);

        template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
            BillingMode: 'PAY_PER_REQUEST',
            KeySchema: [
                { AttributeName: 'pk', KeyType: 'HASH' },
                { AttributeName: 'sk', KeyType: 'RANGE' }
            ]
        });

        template.hasResourceProperties('AWS::SecretsManager::Secret', {
            Description: 'API key for stock data ingest from Massive (prod)'
        });
    });

    it('FrontendStack creates S3 bucket and CloudFront Distribution', () => {
        const app = new cdk.App();
        const stack = new FrontendStack(app, 'TestFrontendStack');
        const template = Template.fromStack(stack);

        template.resourceCountIs('AWS::S3::Bucket', 1);
        template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });
});
