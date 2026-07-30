#!/usr/bin/env bash
# Deploy the current main branch on the EC2 box (run there via SSH):
#   /opt/mindly/deploy/scripts/box-deploy.sh
#
# /opt/mindly is a deploy-target clone, not a working copy — reset --hard is
# intentional. Builds happen on the box (native arch, clean clone: the
# gitignored Norton cert can never leak into images from here).
# The db service is untouched by --build; its volume persists.
set -euo pipefail

cd /opt/mindly
git fetch origin main
git reset --hard origin/main

docker compose -f docker-compose.prod.yml up -d --build

# Old image layers pile up on a 20GB disk fast.
docker image prune -f

docker compose -f docker-compose.prod.yml ps
echo "deployed $(git rev-parse --short HEAD)"
