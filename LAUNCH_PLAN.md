# Launch Plan — Mindly (koan-ai)

Working reference for taking the app from "runs locally" to "published."
Companion to `ARCHITECTURE.md` (how it works) and `CLAUDE.md` (koan voice).
Status legend: ⬜ not started · 🟩 in progress · ✅ done.

---

## Priority checklist

Ordered by what blocks a public URL. Do 1–2 before *any* public deploy.

| # | Item | Why | Status |
|---|------|-----|--------|
| 1 | **Rate-limit `/api/chat` + `/api/auth/login`; add per-user daily chat quota; set Anthropic monthly spend cap** | Open signup + owner's API key + no limits = anyone can drain the wallet. Single true blocker. | 🟩 code done · verify + set Console cap |
| 2 | **Alembic migrations** (replace `Base.metadata.create_all`) | `create_all` never ALTERs existing tables — schema change after real data = stuck. | ⬜ |
| 3 | **Pin dependencies** (`pip freeze`) + drop the antivirus cert/`--trusted-host` hack from the prod image | Unpinned builds drift/break; the CA-append is a local Norton workaround, unsafe to ship. | ⬜ |
| 4 | **Provision managed Postgres**; set `DATABASE_URL`; stop exposing port 5432 publicly | Prod data store; don't leak the DB port. | ⬜ |
| 5 | **Secrets** (`ANTHROPIC_API_KEY`, DB creds) via platform secret store — never in image/git | `docker-compose.yml` hardcodes `koan/koan`; fine local, not prod. | ⬜ |
| 6 | **Deploy backend container + frontend**; set `BACKEND_URL` to the backend URL | The actual publish step. | ⬜ |
| 7 | **HTTPS + domain**, then `COOKIE_SECURE=1` and real `FRONTEND_ORIGIN` | Cookie needs Secure over HTTPS; config already supports the flag. | ⬜ |
| 8 | **Session cleanup job** (`DELETE auth_sessions WHERE expires_at < now()`) + error tracking (Sentry free) | Expired sessions grow forever; need visibility. | ⬜ |
| 9 | **Gate signups** (invite/allowlist) for launch; open once cost behavior is observed | Bounds the audience while watching spend. | ⬜ |
| 10 | **CI** (GitHub Actions): build image + run `pytest` on push | Catch regressions; no API tests exist yet (`backend/tests/` empty). | ⬜ |

### Item 1 — implementation notes (2026-07)
Postgres-backed fixed-window limiter. Files:
- `backend/ratelimit.py` — `_hit` (atomic UPSERT increment), `chat_rate_limited_user` dependency, `enforce_ip_limit`, opportunistic prune.
- `backend/models.py` — `RateCounter` table (auto-created by `create_all`; no migration needed yet).
- `backend/config.py` — env-tunable limits: `CHAT_RATE_PER_MIN=10`, `CHAT_RATE_PER_DAY=100`, `LOGIN_RATE_PER_MIN=10`, `SIGNUP_RATE_PER_MIN=5`.
- `backend/routers/koan.py` — chat uses `chat_rate_limited_user`; logs real token `usage` to stdout.
- `backend/routers/auth.py` — login + signup call `enforce_ip_limit` (per IP/min).
- `app/koan/KoanChat.tsx` — shows the 429 message in-voice instead of "Something dissolved."

**Still to do for item 1:**
- [x] Rebuild + verify (2026-07): image rebuilt, `rate_counters` table created, limiter returns 429 at limit+1 (verified via login: 10×401 → 429), chat happy-path still streams. Measured prefix = 1,708 tokens.
- [ ] Set a **monthly spend cap in the Anthropic Console** (the true backstop) — ~$20–50.  ← only remaining item
- [ ] Optional: behind a proxy (Vercel/Render), confirm `X-Forwarded-For` carries the real client IP so per-IP login/signup limits aren't keyed to the proxy.

### Also worth doing (not launch-blocking)
- Make the `anthropic.Anthropic()` client a module-level singleton (currently built per request in `koan.py`).
- Convert the streaming chat handler to `async` if concurrency pressure appears (sync generator ties up threadpool workers).
- Disable proxy/CDN response buffering on `/api/chat` so the token stream isn't delivered as one lump.
- Finish the `________` → "Mindly" naming pass.
- Add a handful of `pytest` + `httpx` tests: auth, cross-user ownership checks, chat request validation.

---

## Cost model (for setting the cap — item 1)

**Model:** Claude Sonnet 4.5 (`koan.py`). Input **$3**/M · output **$15**/M · cache write **$3.75**/M · cache read **$0.30**/M.

**Per-request shape:**
- Cached prefix (`SYSTEM_PROMPT` + few-shots) = **1,708 tokens** (measured via `usage` on 2026-07) → ~**$0.0005**/req on a cache hit, ~$0.0064 on a cache write.
- Output capped at **150 tokens** → ≤ **$0.00225**/reply (biggest fixed per-reply cost).
- **History re-sent uncached every turn** (cache breakpoint is on the last few-shot, before the real chat) at $3/M → grows each turn = the real cost driver.
- Conversation capped at 50 messages (≈ 25 turns) by `ChatIn` validation.

**What $1 buys:**
| Scenario | Cost | $1 ≈ |
|---|---|---|
| Typical short chat (~60-tok replies) | ~$0.13 / full 25-turn convo | ~8 full convos (~180–200 exchanges) |
| All-fresh short single messages | ~$0.0015 each | ~600–700 messages |
| Abusive (8k-char msgs, 150-tok replies) | ~$2 / maxed convo | ~1 convo (~17 turns) |

**Cap recommendation:** Anthropic Console monthly hard cap **~$20–50** (~$20 ≈ ~150 typical convos) as the backstop, plus per-user rate limit + daily quota so no single account eats it.

**Get exact numbers:** log the stream's final `usage` object (`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`) from `koan.py` — replaces the estimates above with real counts. (Add during item 1.)

---

## Hosting decision (reference)

**Recommendation:** launch on **Vercel (frontend) + Render/Fly/Railway (backend Docker + managed Postgres)**. Migrate backend to **AWS App Runner + RDS** later as a deliberate learning exercise — not launch-blocking.

- **Why the PaaS first:** the app is already "Docker container + Postgres + Next frontend." Render/Fly run the existing `Dockerfile` with ~no new concepts; App Runner reaches the same state but adds IAM, VPC connector, RDS subnet/security groups, Secrets Manager. Same result, more yak-shaving, at near-zero traffic. AWS value (control, résumé) is real but orthogonal to launching.
- **Reach for AWS sooner if:** you already know it, you're targeting AWS jobs and want the hands-on story, or you need an AWS-only service.

**The rewrite-proxy caveat:**
- Browser calls `/api/*` same-origin; `next.config.js` `rewrites()` forwards it **server-side** (in the Next Node process) to `BACKEND_URL`. Browser never sees the backend ⇒ cookie auto-attaches, **no CORS**.
- Requires a **running Node server** (`next dev`/`next start`; Vercel/Amplify/Render-Node provide it). Frontend-on-Vercel + backend-on-Render still works: the rewrite is server-to-server, browser sees only Vercel's origin.
- **If you ever `next export` (static):** no Node server ⇒ `rewrites()` gone ⇒ `/api/*` 404s. Browser must call the backend **directly** = cross-origin ⇒ CORS required (`main.py`'s `CORSMiddleware` is the dormant safety net) **and** cookie must become `SameSite=None; Secure` (currently `Lax` in `security.py`).
- **Takeaway:** keep the proxy → never touch CORS. Static+CORS is a valid alternative, not an upgrade.
