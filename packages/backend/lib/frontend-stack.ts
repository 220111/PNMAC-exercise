import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class FrontendStack extends cdk.Stack {
    public readonly siteBucket: s3.Bucket;
    public readonly distribution: cloudfront.Distribution;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const stage = this.node.tryGetContext('stage') || 'prod';

        this.siteBucket = new s3.Bucket(this, 'FrontendBucket', {
            bucketName: `pnmac-frontend-site-${stage}-${cdk.Aws.ACCOUNT_ID}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: stage !== 'prod',
        });

        const oac = new cloudfront.S3OriginAccessControl(this, 'FrontendOAC', {
            signing: cloudfront.Signing.SIGV4_ALWAYS,
        });

        this.distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(this.siteBucket, {
                    originAccessControl: oac,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/404.html',
                    ttl: cdk.Duration.seconds(300),
                }
            ],
            comment: `CloudFront CDN for PNMAC Frontend (${stage})`,
        });

        new cdk.CfnOutput(this, 'FrontendBucketName', {
            value: this.siteBucket.bucketName,
            description: 'The S3 bucket name to sync frontend files to',
        });

        new cdk.CfnOutput(this, 'FrontendUrl', {
            value: `https://${this.distribution.distributionDomainName}`,
            description: 'The CloudFront URL to access the site',
        });

        new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
            value: this.distribution.distributionId,
            description: 'The CloudFront Distribution ID for cache invalidations',
        });
    }
}
