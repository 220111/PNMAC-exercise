#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { BaseStack } from '../lib/base-stack';

const app = new cdk.App();
new BaseStack(app, 'BackendStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
