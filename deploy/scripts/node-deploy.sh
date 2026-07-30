#!/usr/bin/env bash
# Runs ON THE EC2 NODE (invoked by CI via SSM Run Command, or by hand):
#   /opt/mindly/deploy/scripts/node-deploy.sh <image-tag>
#
# Assumes: /opt/mindly is a clean clone of the repo (the deploy target, not a
# working copy — reset --hard is intentional), kubectl talks to the local K3s,
# and the instance role can read ECR.
#
# Ordering rule encoded here: the API rolls out and becomes healthy BEFORE the
# web frontend — an old backend must never receive requests from newer
# frontend code (it would drop fields it doesn't know, e.g. journal blocks).
set -euo pipefail

TAG="${1:?usage: node-deploy.sh <image-tag>}"
REGION="${AWS_REGION:-us-east-1}"
ECR="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${REGION}.amazonaws.com"

cd /opt/mindly
git fetch origin main
git reset --hard origin/main

# Cluster-scoped issuers first (not part of the kustomization), then the app.
kubectl apply -f deploy/k8s/issuers.yaml
kubectl apply -k deploy/k8s

kubectl -n mindly set image "deployment/api" "api=${ECR}/mindly-api:${TAG}"
kubectl -n mindly rollout status deployment/api --timeout=180s

kubectl -n mindly set image "deployment/web" "web=${ECR}/mindly-web:${TAG}"
kubectl -n mindly rollout status deployment/web --timeout=180s

echo "deployed ${TAG}"
