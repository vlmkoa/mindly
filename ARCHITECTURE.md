# Architecture — ________ (koan-ai)

In-depth reference for the wellness app: stack, script graph, file-by-file responsibilities, call chains, and how the routes map onto the OSI model. Ends with how to run everything.

App name is still a placeholder (`________`). The philosophical chat lives at `/koan`.

> **Rewritten 2026-07:** the backend moved from Next.js Server Actions + Prisma/SQLite
> to a **Python FastAPI** service with **Postgres**, both running in **Docker**.
> The React UI was kept as-is; only its data plumbing changed.

---

## Table of contents

1. [Stack](#1-stack)
2. [Scripts — what calls what](#2-scripts--what-calls-what)
3. [Repository map](#3-repository-map)
4. [File-by-file reference](#4-file-by-file-reference)
5. [Call graphs (what calls what)](#5-call-graphs-what-calls-what)
6. [Routes & how the app works (OSI lens)](#6-routes--how-the-app-works-osi-lens)
7. [Data model](#7-data-model)
8. [How to run](#8-how-to-run)

---

## 1. Stack

| Layer | Technology | Role in this project |
|---|---|---|
| **UI runtime** | React 19 | Client components — pages fetch JSON and render |
| **Frontend framework** | Next.js 16 (App Router, Webpack bundler) | Routing, dev server, `/api/*` proxy to the backend |
| **Frontend language** | TypeScript 5 | Typed UI + `lib/api.ts` client |
| **Backend framework** | FastAPI (Python 3.12) | All application logic: auth, CRUD, koan chat streaming |
| **ORM** | SQLAlchemy 2 | Models + queries (`backend/models.py`) |
| **Database** | PostgreSQL 17 (Docker volume) | All persistent data |
| **Auth** | Session cookie (HttpOnly) + bcrypt | Implemented in `backend/security.py`; no third-party auth service |
| **LLM** | Anthropic Python SDK → Claude Sonnet 4.5 | Streaming koan replies via `POST /api/chat` |
| **Audio** | Web Audio API (browser only) | Synthesized ambient beds, bells, mono/binaural beats — no audio files |
| **Styling** | Plain CSS (`app/globals.css`) | IM Fell English + DM Mono; dark ground; grain overlay |
| **Containers** | Docker Compose | `db` (Postgres) + `api` (FastAPI); frontend runs on the host |
| **Eval (offline)** | Python + Anthropic | `evals/run.py` scores the koan prompt; independent of the web runtime |

### Runtime split

```
┌───────────────────────────────────────────────────────────────┐
│ Browser                                                        │
│   React client components · Web Audio · fetch("/api/...")     │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTP :3000 (same origin)
┌──────────────────────────────▼────────────────────────────────┐
│ Next.js dev/prod server (host)                                 │
│   serves pages · PROXIES /api/* → localhost:8000 (rewrites)    │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTP :8000
┌────────────── Docker ────────▼────────────────────────────────┐
│  api: FastAPI (uvicorn)                                        │
│    auth (bcrypt+cookie) · CRUD · dashboard · chat stream       │
│        │ SQLAlchemy                    │ HTTPS                 │
│  ┌─────▼─────────┐             ┌───────▼───────────────┐       │
│  │ db: Postgres  │             │ api.anthropic.com     │       │
│  │ volume        │             │ Claude Sonnet         │(edge) │
│  └───────────────┘             └───────────────────────┘       │
└────────────────────────────────────────────────────────────────┘
```

Key design point: the browser only ever talks to **one origin** (`localhost:3000`). `next.config.js` rewrites `/api/:path*` to the FastAPI container, so the session cookie flows naturally and no CORS is involved.

---

## 2. Scripts — what calls what

`package.json`:

| Script | Command | What it does |
|---|---|---|
| `dev` | `next dev --webpack` | Frontend dev server on `:3000`; proxies `/api/*` to `BACKEND_URL` |
| `build` | `next build --webpack` | Production build of the frontend into `.next/` |
| `start` | `next start` | Serves the production frontend |
| `backend` | `docker compose up -d --build` | Builds + starts Postgres and the FastAPI image |
| `backend:logs` | `docker compose logs -f api` | Tails backend logs |
| `backend:down` | `docker compose down` | Stops containers (data survives in the volume) |
| `eval` | `python -X utf8 evals/run.py` | Offline koan-prompt eval harness |

Webpack (not Turbopack) is pinned via `--webpack` because Turbopack's dev cache corrupted the React Client Manifest on this project (see git history 2026-07-12).

### Dependency graph

```
npm run backend
    └── docker compose up -d --build
          ├── db  : postgres:17-alpine  (+ healthcheck)
          └── api : backend/Dockerfile
                ├── pip install -r backend/requirements.txt
                ├── COPY backend/ + lib/system-prompt.ts
                └── uvicorn main:app        (creates tables on boot)

npm run dev
    └── next dev --webpack
          └── rewrites /api/* → http://localhost:8000  (BACKEND_URL)

npm run eval
    └── evals/run.py → parses lib/system-prompt.ts → Anthropic API
```

`lib/system-prompt.ts` is the **single source of truth** for the koan voice. Three consumers parse it: the FastAPI backend (`backend/prompt.py`), the eval harness (`evals/run.py`), and git history ties `PROMPT_VERSION` to eval scores.

---

## 3. Repository map

```
koan-ai/
├── app/                       # Next.js pages (UI only — no server logic)
│   ├── layout.tsx             # Root layout → AppShell
│   ├── page.tsx               # Home: dashboard fetch + planner + widgets
│   ├── globals.css            # Design system
│   ├── login/page.tsx         # POST /api/auth/login
│   ├── signup/page.tsx        # POST /api/auth/signup
│   ├── meditate/page.tsx      # FreeMeditation + guided scaffold
│   ├── sobriety/page.tsx      # fetch addictions, cards + add form
│   ├── journal/page.tsx       # fetch entries, today editor + history
│   └── koan/
│       ├── page.tsx           # thin wrapper
│       └── KoanChat.tsx       # streaming chat reader
├── components/                # Shared UI (all client components)
├── lib/                       # Frontend-only helpers
│   ├── api.ts                 # THE API client — every backend call goes here
│   ├── dates.ts               # local-date helpers for display
│   ├── addictions.ts          # preset list
│   ├── audio-engine.ts        # Web Audio synthesis
│   ├── sound-library.ts       # ambient/bell/duration catalogs
│   └── system-prompt.ts       # koan prompt (parsed by backend + evals)
├── backend/                   # FastAPI service (runs in Docker)
│   ├── main.py                # app factory, routers, table creation
│   ├── config.py              # env settings
│   ├── database.py            # SQLAlchemy engine + get_db dependency
│   ├── models.py              # ORM tables
│   ├── schemas.py             # Pydantic (camelCase aliases for the UI)
│   ├── security.py            # bcrypt + session-cookie auth
│   ├── prompt.py              # parses lib/system-prompt.ts
│   ├── requirements.txt
│   ├── Dockerfile
│   └── routers/
│       ├── auth.py            # /api/auth/{signup,login,logout,me}
│       ├── planner.py         # /api/planner/tasks
│       ├── sobriety.py        # /api/sobriety/addictions
│       ├── journal.py         # /api/journal/entries
│       ├── meditation.py      # /api/meditation/sessions
│       ├── koan.py            # /api/chat (stream) + /api/koan/bump
│       └── dashboard.py       # /api/dashboard
├── docker-compose.yml         # db + api services
├── next.config.js             # webpack root + /api proxy rewrites
├── evals/                     # Prompt evaluation harness (unchanged)
└── .env.local                 # ANTHROPIC_API_KEY, BACKEND_URL (gitignored)
```

---

## 4. File-by-file reference

### 4.1 Frontend pages (`app/`)

All pages are client components (`"use client"`) except thin wrappers; the auth guard lives in `AppShell`, not in each page.

| File | Functions | Responsibility |
|---|---|---|
| `app/layout.tsx` | `RootLayout` | HTML shell, metadata, wraps everything in `AppShell` |
| `app/page.tsx` | `HomePage` | `api.dashboard()` → `Planner` + `ProgressWidgets`; `reload` callback re-fetches after mutations |
| `app/login/page.tsx` | `LoginPage` | `api.auth.login` → redirect `/` |
| `app/signup/page.tsx` | `SignupPage` | `api.auth.signup` → redirect `/` |
| `app/meditate/page.tsx` | `MeditatePage` | Renders `FreeMeditation` + guided empty state |
| `app/sobriety/page.tsx` | `SobrietyPage` | `api.sobriety.list()` → cards + add form |
| `app/journal/page.tsx` | `computeStreak`, `JournalPage` | `api.journal.list()`; splits today vs history; client-side streak |
| `app/koan/page.tsx` | `KoanPage` | Thin wrapper |
| `app/koan/KoanChat.tsx` | `KoanChat` | Streams `POST /api/chat` (renders a 429 rate-limit in-voice); `api.koan.bump()` per message |

### 4.2 Components (`components/`)

| File | Exports | Backend calls |
|---|---|---|
| `AppShell.tsx` | `AppShell` | `api.auth.me()` — the auth guard; redirects to `/login` on 401 |
| `Nav.tsx` | `Nav` | `api.auth.logout()` |
| `Planner.tsx` | `Planner` | `api.planner.add/toggle/remove` + `onChanged` refetch |
| `ProgressWidgets.tsx` | `ProgressWidgets` | none (pure display + live sober counters) |
| `FreeMeditation.tsx` | `FreeMeditation` | `api.meditation.save` on timer completion |
| `CountdownTimer.tsx` | `CountdownTimer` | none |
| `AddictionCard.tsx` | `AddictionCard` | `api.sobriety.relapse/stop` |
| `AddAddictionForm.tsx` | `AddAddictionForm` | `api.sobriety.start` |
| `TodayJournal.tsx` | `TodayJournal` | `api.journal.upsert` |
| `JournalHistory.tsx` | `JournalHistory` | none |

### 4.3 Frontend lib (`lib/`)

| File | Exports | Notes |
|---|---|---|
| `api.ts` | `api`, `ApiError`, `localToday`, DTO types | Single point of HTTP contact; camelCase DTOs match backend schema aliases |
| `dates.ts` | `formatDuration`, `monthLabel`, … | Display helpers |
| `addictions.ts` | `ADDICTION_PRESETS` | Preset list |
| `audio-engine.ts` | `createAudioEngine`, `playBell`, `beatBandLabel`, `SoundConfig` | Web Audio synthesis (browser only) |
| `sound-library.ts` | `AMBIENT_PRESETS`, `BELL_TYPES`, `DURATION_OPTIONS` | Sound catalogs |
| `system-prompt.ts` | `SYSTEM_PROMPT`, `FEW_SHOT_EXEMPLARS`, `PROMPT_VERSION` | Parsed by backend + evals; never edited casually — see CLAUDE.md |

### 4.4 Backend (`backend/`)

| File | Key functions | Responsibility |
|---|---|---|
| `main.py` | `lifespan`, `health` | App factory; `create_all` on boot; CORS safety net; router registration |
| `config.py` | constants | `DATABASE_URL`, `ANTHROPIC_API_KEY`, cookie params, rate-limit caps — all env-driven |
| `database.py` | `get_db` | Engine (`pool_pre_ping`) + per-request session dependency |
| `models.py` | `User`, `AuthSession`, `MeditationSession`, `Addiction`, `RelapseEvent`, `JournalEntry`, `PlannerTask`, `KoanSession`, `RateCounter` | ORM tables; UUID-hex PKs; UTC timestamps; local-date strings |
| `schemas.py` | `CamelModel` + per-feature In/Out models | Pydantic validation; camelCase aliases so the React props stay unchanged |
| `security.py` | `hash_password`, `verify_password`, `create_session`, `destroy_session`, `current_user` | bcrypt hashing; opaque token in HttpOnly `koan_session` cookie; `current_user` dependency 401s |
| `prompt.py` | `load_system_prompt`, `load_few_shot_exemplars` | Parses the TS prompt file; guards against the historical empty-prompt bug |
| `ratelimit.py` | `chat_rate_limited_user`, `enforce_ip_limit`, `_hit` | Postgres-backed fixed-window rate limiting; per-user chat caps + per-IP login/signup caps; atomic UPSERT increment on `rate_counters` |
| `routers/auth.py` | `signup`, `login`, `logout`, `me` | Session issue/destroy; identical error for bad email vs bad password; login/signup rate-limited per IP |
| `routers/planner.py` | `list_tasks`, `create_task`, `toggle_task`, `delete_task` | Ownership-checked CRUD |
| `routers/sobriety.py` | `list_addictions`, `start_tracking`, `record_relapse`, `stop_tracking` | Relapse archives the ended streak (`previous_start`) then resets the clock |
| `routers/journal.py` | `list_entries`, `upsert_entry` | One entry per user+date; whole-entry overwrite |
| `routers/meditation.py` | `save_session` | Logs completed sessions (audio never leaves the browser) |
| `routers/koan.py` | `chat`, `bump_session` | Claude streaming with cached few-shot prefix; chat rate-limited per user (10/min, 100/day) and logs token usage; usage widget counter |
| `routers/dashboard.py` | `dashboard` | One-call aggregation; browser sends local `today` + tz offset so streaks/day-bars follow the user's calendar |

### 4.5 Infrastructure

| File | Role |
|---|---|
| `docker-compose.yml` | `db` (postgres:17-alpine + healthcheck + named volume) and `api` (built from `backend/Dockerfile`); `api` reads `ANTHROPIC_API_KEY` from `.env.local` |
| `backend/Dockerfile` | python:3.12-slim (3.13's strict X.509 checks reject antivirus TLS-interception certs); installs requirements; copies `backend/` + `lib/system-prompt.ts`; trusts any local root CAs dropped in `backend/certs/` (see its README) |
| `next.config.js` | Webpack root + `/api/:path*` rewrite to `BACKEND_URL` |
| `.env.local` | `ANTHROPIC_API_KEY`, `BACKEND_URL` (frontend + compose `env_file`) |

### 4.6 Evals (out of band)

`evals/run.py` + `evals/test_cases.py` — LLM-as-judge scoring of the koan prompt. Talks to Anthropic directly; does not touch the web app or the database. See `evals/ITERATIONS.md`.

---

## 5. Call graphs (what calls what)

### 5.1 App boot & auth guard

```
Browser GET localhost:3000/
    → Next serves the page shell (static)
    → AppShell (client) mounts
        → api.auth.me()  →  GET /api/auth/me
            → [Next rewrite] → FastAPI → current_user()
                → cookie "koan_session" → AuthSession row → User
        ← 200 {id,email,name}   → render Nav + page
        ← 401                    → router.replace("/login")
```

### 5.2 Signup / login

```
LoginPage → api.auth.login({email,password})
    → POST /api/auth/login
        → verify_password(bcrypt)
        → create_session(): INSERT auth_sessions + Set-Cookie koan_session
    ← 200 user JSON (cookie now in the browser jar)
→ router.push("/")  → AppShell re-checks /api/auth/me → authenticated
```

### 5.3 A mutation (add planner task)

```
Planner.onAdd
    → api.planner.add(title)              # includes localToday() date
        → POST /api/planner/tasks
            → current_user(cookie) → INSERT planner_tasks → commit
        ← 200 TaskOut (camelCase)
    → onChanged() → api.dashboard() → widgets re-render
```

(The `onChanged → refetch` pattern replaces the old `revalidatePath` server-side cache invalidation.)

### 5.4 Koan chat stream

```
KoanChat.send()
    → api.koan.bump()                     # fire-and-forget widget counter
    → fetch POST /api/chat {messages}
        → [Next rewrite] → FastAPI chat()
            → chat_rate_limited_user: per-user 10/min + 100/day → 429 if over
            → validates roles/lengths (≤50 msgs, ≤8000 chars)
            → anthropic client.messages.stream(
                  system=SYSTEM_PROMPT,            # parsed from lib/system-prompt.ts
                  messages=[*FEW_SHOT_EXEMPLARS,   # last one cache-marked
                            *user_messages])
            → StreamingResponse yields text chunks
    → res.body.getReader() loop appends chunks to the last message
```

### 5.5 Meditation session

```
FreeMeditation.start()
    → createAudioEngine()                 # browser AudioContext
    → engine.start(config)                # drones / bells / beats
    → CountdownTimer … onComplete
        → engine.strikeBell / stop
        → api.meditation.save({kind, durationSec, soundConfig})
            → POST /api/meditation/sessions → INSERT
```

No audio bytes cross the network — only the session metadata at the end.

---

## 6. Routes & how the app works (OSI lens)

HTTP routes live at **Layer 7**, but each request traverses the whole stack. Below: the route catalog, then worked examples described top-down (L7 → L1).

### 6.1 OSI layers as used by this app

| OSI layer | Name | In this app |
|---|---|---|
| **7** | Application | Next.js pages + proxy, FastAPI endpoints, Anthropic Messages API, SQL over the Postgres wire protocol |
| **6** | Presentation | UTF-8 JSON bodies; plain-text chat chunks; HTML; cookie serialization; TLS encryption on the Anthropic hop |
| **5** | Session | `koan_session` HttpOnly cookie ↔ `auth_sessions` row — the app-level session |
| **4** | Transport | TCP: browser→3000 (Next), Next→8000 (FastAPI), api→5432 (Postgres), api→443 (Anthropic) |
| **3** | Network | Loopback (127.0.0.1) for local hops; Docker bridge network between `api` and `db`; public Internet to Anthropic |
| **2** | Data Link | Loopback/virtual Ethernet (Docker bridge); NIC frames for Internet traffic |
| **1** | Physical | Wi-Fi / cable (only the Anthropic hop actually leaves the machine) |

> TLS is usually drawn across L5/L6. Locally everything is plain HTTP; the only encrypted hop is FastAPI → `api.anthropic.com:443`.

### 6.2 Route catalog (Layer 7)

**Frontend document routes** (served by Next.js):

| Path | Auth | Purpose |
|---|---|---|
| `/` | guarded client-side | Dashboard |
| `/meditate`, `/sobriety`, `/journal`, `/koan` | guarded client-side | Feature tabs |
| `/login`, `/signup` | public | Auth forms |

**API routes** (proxied by Next → handled by FastAPI):

| Method + path | Handler | Auth | Purpose |
|---|---|---|---|
| `POST /api/auth/signup` | `auth.signup` | issues cookie · 5/min per IP | Create account |
| `POST /api/auth/login` | `auth.login` | issues cookie · 10/min per IP | Sign in |
| `POST /api/auth/logout` | `auth.logout` | cookie | Destroy session |
| `GET /api/auth/me` | `auth.me` | cookie | Who am I (guard) |
| `GET /api/dashboard?today=&tz_offset_min=` | `dashboard.dashboard` | cookie | Home aggregation |
| `GET/POST /api/planner/tasks`, `PATCH/DELETE /api/planner/tasks/{id}` | `planner.*` | cookie | Planner CRUD |
| `GET/POST /api/sobriety/addictions`, `POST .../{id}/relapse`, `POST .../{id}/stop` | `sobriety.*` | cookie | Sobriety |
| `GET /api/journal/entries`, `PUT /api/journal/entries` | `journal.*` | cookie | Journal |
| `POST /api/meditation/sessions` | `meditation.save_session` | cookie | Log session |
| `POST /api/chat` | `koan.chat` | cookie · 10/min, 100/day per user | **Streaming** koan reply |
| `POST /api/koan/bump` | `koan.bump_session` | cookie | Usage counter |
| `GET /api/health` | `main.health` | public | Liveness probe |

### 6.3 Worked example A — open Home

```
L7  GET localhost:3000/  → Next serves the page shell.
    AppShell fires GET /api/auth/me, then GET /api/dashboard.
    Next's rewrite proxies both to FastAPI :8000; FastAPI queries Postgres.
L6  Responses are UTF-8 JSON (camelCase via Pydantic aliases).
L5  Cookie koan_session identifies the auth_sessions row → user.
L4  Three TCP legs: browser→3000, next→8000, api→5432.
L3  All loopback/Docker-bridge IPs — nothing leaves the machine.
L2–L1  Virtual interfaces (loopback, Docker vEthernet).
```

### 6.4 Worked example B — sign in

```
L7  POST /api/auth/login {email,password} → bcrypt verify → session INSERT.
L6  Request JSON; response carries Set-Cookie: koan_session=<token>; HttpOnly; SameSite=Lax.
L5  New session established — the cookie is the session handle.
L4–L1  Same local TCP path as above.
```

### 6.5 Worked example C — koan chat (the only hop that leaves the laptop)

```
L7  POST /api/chat → FastAPI validates → Anthropic Messages API (streaming).
L6  Browser←FastAPI: text/plain chunked UTF-8.
    FastAPI←Anthropic: TLS-encrypted JSON event stream.
L5  Browser side: koan_session cookie (endpoint requires login).
    Anthropic side: x-api-key header (credential, not an OSI session).
L4  TCP browser→3000, next→8000, and TLS-over-TCP api→api.anthropic.com:443.
L3  The Anthropic leg routes over the public Internet.
L2–L1  Wi-Fi/Ethernet for that leg; everything else stays on-box.
```

### 6.6 Worked example D — meditation audio

```
L7–L1  None. Web Audio synthesis runs inside the browser process.
       Only the completion metadata POST (example C-style local hop) touches
       the network.
```

---

## 7. Data model

```
users ─┬─ auth_sessions          (cookie token → user)
       ├─ meditation_sessions
       ├─ addictions ── relapse_events
       ├─ journal_entries        (unique user+date, enforced by upsert)
       ├─ planner_tasks
       └─ koan_sessions
```

| Table | Key fields | Notes |
|---|---|---|
| `users` | id, email (unique), name, password_hash | bcrypt hashes |
| `auth_sessions` | token (unique), user_id, expires_at | 30-day TTL, HttpOnly cookie |
| `meditation_sessions` | kind, duration_sec, sound_config (JSON) | written on timer completion |
| `addictions` | type, label, sobriety_start, active | live timer = now − sobriety_start |
| `relapse_events` | previous_start, occurred_at | history → longest streak |
| `journal_entries` | date "YYYY-MM-DD", mode, 4 text fields | one per user per local day |
| `planner_tasks` | date, title, done | home planner |
| `koan_sessions` | started_at, message_count | one per rolling hour |
| `rate_counters` | key, window_start, count | fixed-window rate-limit counters; unique(key, window_start); not user-scoped (keys are `chat:*:<user_id>` or `login:*:<ip>`) |

Tables are created by `Base.metadata.create_all` at API startup. When the schema starts evolving with real data, introduce Alembic migrations.

---

## 8. How to run

### Prerequisites

- **Docker Desktop** (running) — hosts Postgres + the FastAPI backend
- **Node.js 20+** — hosts the Next.js frontend
- **Anthropic API key** — for `/koan` (and evals)

### First-time setup

```bash
cd koan-ai
npm install

# Env: copy the sample and fill in your key
cp .env.example .env.local
#   ANTHROPIC_API_KEY=sk-ant-...
#   BACKEND_URL=http://localhost:8000
```

### Start the backend (Docker)

```bash
npm run backend          # = docker compose up -d --build
npm run backend:logs     # tail the API logs (Ctrl+C to stop tailing)
```

First build downloads the Python/Postgres images — give it a few minutes. The API creates its tables automatically on boot. Verify with:

```bash
curl http://localhost:8000/api/health   # → {"ok":true}
```

### Start the frontend

```bash
npm run dev              # http://localhost:3000
```

Create an account at `/signup`, then use the tabs.

### Stopping

```bash
npm run backend:down     # stop containers; data persists in the volume
docker compose down -v   # stop AND wipe the database (destructive)
```

### Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | FastAPI (via compose `env_file`), evals | server-side only |
| `BACKEND_URL` | Next.js rewrites | defaults to `http://localhost:8000` |
| `DATABASE_URL` | FastAPI | set in docker-compose; only override for non-Docker runs |
| `COOKIE_SECURE` | FastAPI | set `1` behind HTTPS in production |

### Running the backend without Docker (debugging)

```bash
cd backend
pip install -r requirements.txt
# needs a reachable Postgres, e.g. the compose db:
#   DATABASE_URL=postgresql+psycopg://koan:koan@localhost:5432/koan
uvicorn main:app --reload --port 8000
```

### Evals (koan prompt only)

```bash
pip install anthropic
npm run eval             # or: python -X utf8 evals/run.py
```

---

## Quick glossary

| Term | Meaning here |
|---|---|
| **Rewrite/proxy** | `next.config.js` forwards `/api/*` to FastAPI — one origin for the browser |
| **Session cookie** | HttpOnly `koan_session`; opaque token mapped to a DB row |
| **DTO** | The camelCase JSON shapes in `lib/api.ts`, mirrored by Pydantic aliases |
| **`onChanged` refetch** | Client-side replacement for the old `revalidatePath` pattern |
| **Few-shot exemplars** | Fixed user/assistant turns prepended to every chat request to shape the koan voice |

---

*For prompt iteration history see `evals/ITERATIONS.md` and `CLAUDE.md`.*
