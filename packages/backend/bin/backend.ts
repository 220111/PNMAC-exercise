#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { BaseStack } from '../lib/base-stack';
import { ComputeStack } from '../lib/compute-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const base = new BaseStack(app, 'PNMACBaseStack', {
  env,
});

new ComputeStack(app, 'PNMACComputeStack', {
  env,
  ingestTable: base.ingestTable,
  apiSecret: base.apiSecret,
  sharedLogGroup: base.sharedLogGroup,
})

new ApiStack(app, 'PNMACApiStack', {
  env,
  ingestTable: base.ingestTable,
  sharedLogGroup: base.sharedLogGroup, 
});