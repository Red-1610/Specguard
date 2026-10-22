#!/usr/bin/env bash
# ==============================================================================
# SpecGuard AWS Deployment Helper
# Builds container images, pushes to Amazon ECR, and prepares for AWS ECS Fargate
# Usage:
#   ./aws/deploy.sh            # Builds and pushes both backend & frontend
#   ./aws/deploy.sh backend    # Builds and pushes backend only
#   ./aws/deploy.sh frontend   # Builds and pushes frontend only
# ==============================================================================

set -euo pipefail

TARGET="${1:-backend}"
AWS_REGION="${AWS_REGION:-us-east-1}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=========================================================="
echo "🛡️  SpecGuard AWS Cloud Deployment Script (ECS / ECR)"
echo "=========================================================="

# 1. Verify AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed or not in PATH."
    echo "   Tip: Run this script directly in AWS CloudShell where AWS CLI and Docker are pre-installed."
    exit 1
fi

# 2. Detect Container CLI (Docker or Podman)
if command -v docker &> /dev/null && docker info &> /dev/null; then
    CONTAINER_CLI="docker"
elif command -v podman &> /dev/null; then
    CONTAINER_CLI="podman"
elif command -v docker &> /dev/null; then
    CONTAINER_CLI="docker"
else
    echo "❌ Neither docker nor podman was found on this system."
    exit 1
fi
echo "🐳 Using Container Runtime: ${CONTAINER_CLI}"

# 3. Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "📍 AWS Account:  ${AWS_ACCOUNT_ID}"
echo "📍 AWS Region:   ${AWS_REGION}"
echo "📍 Target Mode:  ${TARGET}"
echo "----------------------------------------------------------"

# 4. Authenticate Container Runtime with Amazon ECR
echo "🔐 Authenticating ${CONTAINER_CLI} with Amazon ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | "${CONTAINER_CLI}" login --username AWS --password-stdin "${ECR_BASE}"

# Helper function to build and push an image
build_and_push() {
    local REPO_NAME="$1"
    local DOCKERFILE_PATH="$2"
    local BUILD_CONTEXT="$3"
    local FULL_URI="${ECR_BASE}/${REPO_NAME}:${IMAGE_TAG}"

    echo ""
    echo "📦 Checking/Creating Amazon ECR repository: ${REPO_NAME}..."
    aws ecr describe-repositories --repository-names "${REPO_NAME}" --region "${AWS_REGION}" > /dev/null 2>&1 || \
        aws ecr create-repository --repository-name "${REPO_NAME}" --region "${AWS_REGION}" > /dev/null

    echo "🔨 Building ${REPO_NAME} (Linux amd64 for AWS ECS Fargate)..."
    "${CONTAINER_CLI}" build --platform linux/amd64 -t "${REPO_NAME}:${IMAGE_TAG}" -f "${DOCKERFILE_PATH}" "${BUILD_CONTEXT}"

    echo "🏷️ Tagging image: ${FULL_URI}..."
    "${CONTAINER_CLI}" tag "${REPO_NAME}:${IMAGE_TAG}" "${FULL_URI}"

    echo "🚀 Pushing ${REPO_NAME} to Amazon ECR..."
    "${CONTAINER_CLI}" push "${FULL_URI}"

    echo "✅ Successfully pushed: ${FULL_URI}"
}

# 5. Execute Build & Push based on target
if [[ "${TARGET}" == "backend" || "${TARGET}" == "all" || "${TARGET}" == "both" ]]; then
    build_and_push "specguard-backend" "backend/Dockerfile" "./backend"
fi

if [[ "${TARGET}" == "frontend" || "${TARGET}" == "all" || "${TARGET}" == "both" ]]; then
    build_and_push "specguard-frontend" "frontend/frontend/Dockerfile" "./frontend/frontend"
fi

echo ""
echo "=========================================================="
echo "🎉 Image build & push complete!"
echo "=========================================================="
echo ""
echo "Next Steps for AWS ECS Fargate:"
echo "1. Register/Update ECS Task Definition:"
echo "   aws ecs register-task-definition --cli-input-json file://aws/ecs-task-def.json --region ${AWS_REGION}"
echo ""
echo "2. Update ECS Service to run the new task:"
echo "   aws ecs update-service --cluster specguard-cluster --service specguard-backend-task-service --force-new-deployment --region ${AWS_REGION}"
echo ""
echo "3. Verify backend health:"
echo "   curl http://<TASK_PUBLIC_IP>:8000/health"
echo "=========================================================="
