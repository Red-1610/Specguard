#!/usr/bin/env bash
# ==============================================================================
# SpecGuard AWS Deployment Helper
# Builds backend container, pushes to Amazon ECR, and deploys to AWS App Runner
# ==============================================================================

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO_NAME="${ECR_REPO_NAME:-specguard-backend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=========================================================="
echo "🛡️  SpecGuard AWS Cloud Deployment Script"
echo "=========================================================="

# 1. Verify AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# 2. Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "📍 AWS Account:  ${AWS_ACCOUNT_ID}"
echo "📍 AWS Region:   ${AWS_REGION}"
echo "📍 Target Image: ${ECR_URI}:${IMAGE_TAG}"
echo "----------------------------------------------------------"

# 3. Ensure ECR Repository Exists
echo "📦 1/4 Checking/Creating Amazon ECR repository: ${ECR_REPO_NAME}..."
aws ecr describe-repositories --repository-names "${ECR_REPO_NAME}" --region "${AWS_REGION}" > /dev/null 2>&1 || \
    aws ecr create-repository --repository-name "${ECR_REPO_NAME}" --region "${AWS_REGION}" > /dev/null

# 4. Authenticate Docker with Amazon ECR
echo "🔐 2/4 Authenticating local container runtime with ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# 5. Build and Tag Backend Container Image
echo "🔨 3/4 Building backend image (Linux amd64 for AWS Fargate/App Runner)..."
docker build --platform linux/amd64 -t "${ECR_REPO_NAME}:${IMAGE_TAG}" -f backend/Dockerfile ./backend
docker tag "${ECR_REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"

# 6. Push to ECR
echo "🚀 4/4 Pushing container image to Amazon ECR..."
docker push "${ECR_URI}:${IMAGE_TAG}"

echo "----------------------------------------------------------"
echo "✅ Backend image pushed successfully to:"
echo "   ${ECR_URI}:${IMAGE_TAG}"
echo "=========================================================="
echo ""
echo "Next Steps to complete AWS deployment:"
echo "1. Deploy Backend via AWS App Runner (Console or CLI):"
echo "   Create service using image: ${ECR_URI}:${IMAGE_TAG}"
echo "   Set port: 8000, Health check: /health"
echo "   Attach IAM Role with Bedrock InvokeModel permission (see aws/iam-bedrock-policy.json)"
echo ""
echo "2. Deploy Frontend via AWS Amplify:"
echo "   Connect your GitHub repository to AWS Amplify Console"
echo "   Amplify will automatically use the amplify.yml in your repo"
echo "   Set Environment Variables in Amplify:"
echo "     NEXT_PUBLIC_API_URL=https://<your-app-runner-url>"
echo "     NEXT_PUBLIC_SUPABASE_URL=https://erjfircpaehnlmfrjqql.supabase.co"
echo "     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your_key>"
echo ""
echo "3. Supabase Auth Dashboard:"
echo "   Add your Amplify URL to 'Site URL' and 'Redirect URLs'"
echo "=========================================================="
