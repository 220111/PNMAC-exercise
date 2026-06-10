# PNMAC Stock Pipeline

Monorepo containing a serverless data ingestion pipeline and a Next.js dashboard tracking stock movements for the watchlist: `["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA"]`.

## Project Structure

```
├── packages/
│   ├── backend/      # CDK app
│   └── frontend/     # Next.js static site
├── .github/
│   └── workflows/    # CI/CD deployment workflow
└── package.json      # Workspace root
```

## Local Development

### 1. Install dependencies
Run from the root directory:
```bash
npm install
```

### 2. Run tests (Mocked)
Runs mock Lambda unit tests and CDK assertions:
```bash
npm test
```

### 3. Run frontend locally
Starts the local Next.js development server:
```bash
npm run dev
```
Open `http://localhost:3000` to view.

## Sandbox / Dev Deployments

The CDK app supports dynamic stack names via the `stage` context parameter. This lets you deploy isolated stacks on your AWS account.

### 1. Deploy dev stacks
Run this command from the root directory to deploy the stacks:
```bash
npm run cdk deploy -- --all --context stage=dev --require-approval never
```

### 2. Populate the Massive API Key Secret
By default, the secret is created but empty. You must write your [Massive API Key](https://massive.com/dashboard/keys) to Secrets Manager before running the ingestion Lambda:
```bash
aws secretsmanager put-secret-value --secret-id ingest/massive-api-key-dev --secret-string "YOUR_MASSIVE_API_KEY"
```

### 3. Trigger the Ingestion Lambda
To populate the DynamoDB table with initial stock movers history:
> **Note: This takes about 10 minutes due to external API rate limiting.**
```bash
npm run cdk:trigger-dev
```

Alternatively, you can copy the physical function name from the deployment terminal output (`IngestLambdaName`) and run the AWS CLI command manually:
```bash
aws lambda invoke --function-name <IngestLambdaPhysicalName> --invocation-type Event --payload '{}' --cli-binary-format raw-in-base64-out response.json
```

### 4. Clean up dev stacks
To delete all dev resources:
```bash
npm run cdk destroy -- --all --context stage=dev --force
```

## CI/CD Deployment (GitHub Actions)

The deployment pipeline uses AWS OpenID Connect (OIDC) to authenticate. This enables GitHub Actions to assume a temporary role in AWS without storing static IAM access keys in GitHub Secrets.

### Step 1: Deploy OIDC Role on AWS
Deploy the CloudFormation template using your local AWS CLI (replace `<github-username>` with your organization/username):
```bash
aws cloudformation deploy \
  --template-file packages/backend/github-oidc-role.yaml \
  --stack-name PNMAC-GitHub-OIDC \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides GitHubOrg=<github-username> RepositoryName=PNMAC-exercise
```

### Step 2: Get the Role ARN
```bash
aws cloudformation describe-stacks \
  --stack-name PNMAC-GitHub-OIDC \
  --query "Stacks[0].Outputs[0].OutputValue" \
  --output text
```

### Step 3: Configure GitHub Secrets
1. Go to repository **Settings -> Secrets and variables -> Actions**.
2. Add a repository secret named `AWS_ROLE_ARN` containing the Role ARN output from Step 2.

### Step 4: Run Deploy
Pushing to the `main` branch triggers the deploy workflow (`deploy.yml`), which:
1. Runs the linter and unit tests.
2. Deploys the production CDK stacks (`cdk deploy --all --context stage=prod`).
3. Captures the generated API Gateway URL.
4. Builds the frontend static site with the API URL injected as `NEXT_PUBLIC_API_URL`.
5. Syncs static files to the S3 bucket.
6. Invalidates CloudFront cache.

### Step 5: (Optional) Trigger Production Ingestion
If you want to manually trigger the ingestion Lambda in production immediately (rather than waiting for the nightly Cron):
```bash
npm run cdk:trigger-prod
```
