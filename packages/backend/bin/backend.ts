#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { BaseStack } from '../lib/base-stack';
import { ComputeStack } from '../lib/compute-stack';
import { ApiStack } from '../lib/api-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'prod';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const base = new BaseStack(app, `PNMACBaseStack-${stage}`, {
  env,
});

new ComputeStack(app, `PNMACComputeStack-${stage}`, {
  env,
  ingestTable: base.ingestTable,
  apiSecret: base.apiSecret,
  sharedLogGroup: base.sharedLogGroup,
})

new ApiStack(app, `PNMACApiStack-${stage}`, {
  env,
  ingestTable: base.ingestTable,
  sharedLogGroup: base.sharedLogGroup, 
});

new FrontendStack(app, `PNMACFrontendStack-${stage}`, {
  env,
});