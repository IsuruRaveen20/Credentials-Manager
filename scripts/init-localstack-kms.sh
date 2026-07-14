#!/usr/bin/env bash
set -euo pipefail

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"

echo "Creating KMS key on LocalStack at ${ENDPOINT}..."
KEY_ID="$(aws --endpoint-url="${ENDPOINT}" kms create-key --description "vaultops-dev" --query KeyMetadata.KeyId --output text)"
ALIAS="${KMS_ALIAS:-alias/vaultops-dev}"

aws --endpoint-url="${ENDPOINT}" kms create-alias --alias-name "${ALIAS}" --target-key-id "${KEY_ID}" >/dev/null || true

echo "KMS_KEY_ID=${ALIAS}"
echo "AWS_ENDPOINT_URL=${ENDPOINT}"
