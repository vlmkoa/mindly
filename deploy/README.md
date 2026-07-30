# Deploying mindly

Two stages, by design:

1. **Live now — one EC2 box, Docker Compose + Caddy** (this is what serves
   production today).
2. **Milestone 2 — Kubernetes (K3s)** on the same foundation: the manifests
   under `k8s/` are complete and waiting; migrating is "resize the box,
   install K3s, `kubectl apply -k`". Same domain, Elastic IP, security
   group, IAM role, S3 bucket.

---

## Stage 1 — Live deployment (Docker Compose + Caddy)

```
Route53 ─── Elastic IP
           │ :80 / :443
   ┌───────▼──── EC2 t4g.small ─────────┐
   │  docker compose (mindly-prod)      │
   │   caddy ── auto Let's Encrypt TLS  │
   │     ├─ /api/* ─► api :8000         │
   │     └─ /      ─► web :3000         │
   │   db (postgres:17, named volume)   │
   │  host cron: pg_dump ─► S3 nightly  │
   └────────────────────────────────────┘
```

- **Single origin.** Caddy splits `/api` vs `/` exactly like the future K3s
  ingress; the Next rewrite proxy in `next.config.js` is dev-only.
- **Streaming-safe.** `flush_interval -1` on the api route — the koan chat
  arrives word-by-word.
- **Stateless app containers**; all state in the `pgdata_prod` volume,
  backed up nightly (logical dump → S3) + daily EBS snapshots.
- **No keys on the box**: S3 uploads use the EC2 instance role.

### Files

| Path | What |
|---|---|
| `../docker-compose.prod.yml` | The stack (caddy, web, api, db) |
| `caddy/Caddyfile` | TLS + routing (reads `DOMAIN` from env) |
| `scripts/box-deploy.sh` | Pull main + rebuild + restart on the box |
| `scripts/backup.sh` | Nightly host-cron dump → S3 (+ restore drill in header) |
| `secrets.example.env` | Template for the one secrets file |

### First deploy runbook

1. **AWS** (console, ~1h): Route53 domain (register first — takes up to an
   hour) · SG: 80+443 world, 22 owner-IP only · IAM role
   (`AmazonSSMManagedInstanceCore` + S3 Put/List on the backup bucket) ·
   launch t4g.small, Ubuntu 24.04 arm64, 20GB gp3, role attached, IMDSv2
   **hop limit 2** (future-proofs K3s) · Elastic IP + A record · S3 bucket
   (Block Public Access, 30-day lifecycle) · DLM daily snapshot, retain 7.
2. **Box** (SSH):
   ```
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
   sudo systemctl enable --now docker
   sudo snap install aws-cli --classic
   # 2GB swap — next build inside Dockerfile.web peaks ~1.5GB on a 2GB box
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   sudo git clone https://github.com/vlmkoa/mindly.git /opt/mindly
   ```
3. **Config** (both gitignored, on the box only):
   - `/opt/mindly/.env` → `DOMAIN=yourdomain.tld` and
     `MINDLY_BACKUP_BUCKET=mindly-backups-<acct>`
   - `/opt/mindly/deploy/secrets.env` from `secrets.example.env`
     (password: `openssl rand -hex 24`; **DATABASE_URL host is `db`** here —
     the compose service — vs `postgres` under K8s)
4. **Up**: `docker compose -f docker-compose.prod.yml up -d --build`
   (first build ~10–15 min). Caddy self-issues the cert once DNS resolves —
   watch `docker compose -f docker-compose.prod.yml logs -f caddy`.
5. **Backups**: `sudo mkdir -p /opt/backups`, then the cron line from
   `scripts/backup.sh`'s header. Run it once by hand and check the S3 object.
6. **Anthropic Console spend cap** — set it before inviting users.

### Verify (go-live gate)

```
curl https://<domain>/api/health          # {"ok":true}
curl -sI http://<domain> | head -1        # 308 https redirect
openssl s_client -connect <domain>:443 -servername <domain> </dev/null 2>/dev/null \
  | openssl x509 -noout -issuer           # Let's Encrypt
# signup response must show: HttpOnly; Secure; SameSite=lax
# curl -N on /api/chat must print word-by-word (no buffering)
# browser pass: signup → journal → koan chat → refresh
# reboot the box: stack must come back on its own
```

### Day-2

Deploys: push to main, then on the box `deploy/scripts/box-deploy.sh`.
Monthly: `apt upgrade` + reboot window; `df -h` (image layers + dumps).
Quarterly: restore drill (header of `scripts/backup.sh`).

---

## Stage 2 (milestone) — Kubernetes on K3s

The full design lives in `k8s/` — every manifest carries its ops notes in
header comments. Summary:

```
   ┌─────────── same EC2, resized to t4g.medium ──┐
   │  K3s (single node)                           │
   │  Traefik ingress ── cert-manager (ACME/LE)   │
   │     /api ─► api  (Deployment, Recreate)      │
   │     /    ─► web  (Deployment)                │
   │        postgres-0 (StatefulSet + PVC)        │
   │  CronJobs: pg_dump→S3 · db cleanup           │
   └──────────────────────────────────────────────┘
   Images: ECR (kubelet credential provider, IMDSv2)
   Deploys: GitHub Actions (OIDC) → ECR → SSM Run Command
```

Migration outline: resize instance → open 6443 to owner IP → install K3s
(`tls-san` = EIP + domain) + cert-manager + the ECR credential provider →
build/push images to ECR → search `REPLACE` in `k8s/` (domain, registry,
bucket) → move data (pg_dump from the compose volume, restore into the
StatefulSet) → `kubectl apply -f k8s/issuers.yaml` + `kubectl apply -k k8s`
→ patch the PV to `Retain` → flip DNS is not even needed (same IP).
