# ________ — stillness, reflection, dissolution

> A meditation, sobriety, journal, and planner app — with a koan mirror that dissolves certainty.

App name is a placeholder (`________`) until one is chosen. The original koan chat lives at `/koan`.

**Deep dive:** see [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full stack, npm script graph, file-by-file reference, call chains, OSI-layered route walkthroughs, and run instructions.

---

## What it is

A multi-tab wellness shell around the original koan AI:

| Tab | Purpose |
|---|---|
| **Home** | Daily planner + progress widgets for every feature |
| **Meditate** | Free timer with synthesized sound builder (ambient / bells / mono & binaural beats); guided section scaffolded |
| **Sobriety** | Track addictions with live sober timers, resets, and longest-streak history |
| **Journal** | Daily free write or three prompted sections; month-grouped history |
| **Koan** | The philosophical mirror — destabilizes certainty without taking a side |

Design language is unchanged: IM Fell English + DM Mono, dark brown ground, grain overlay, amber accents.

---

## Stack

- Next.js 16 (App Router, Webpack) + React 19 + TypeScript — UI only
- FastAPI (Python) — auth, CRUD, dashboard, koan chat streaming
- PostgreSQL 17 in Docker (data lives in a Docker volume, not on disk in the repo)
- Session-cookie auth (bcrypt + HttpOnly cookie, no third-party auth service)
- Anthropic Claude API for `/koan` (streaming Sonnet)
- Web Audio API for all meditation sound (no audio files)
- Python eval harness for the koan prompt (`evals/`)

## Architecture

```
Browser
  │
  ├── App shell (Nav + client-side auth guard)
  │     ├── /            planner + widgets
  │     ├── /meditate    free timer + sound builder
  │     ├── /sobriety    addiction timers
  │     ├── /journal     daily entry + history
  │     └── /koan        streaming chat UI
  │
  └── fetch /api/*  →  Next rewrite proxy  →  FastAPI (Docker :8000)
                                                 ├── Postgres (Docker :5432)
                                                 └── /api/chat → Claude Sonnet
```

The koan prompt and eval harness are unchanged — see [`evals/ITERATIONS.md`](evals/ITERATIONS.md) and the historical notes below.

---

## Setup

Prerequisites: Node 20+, Docker Desktop (running), an Anthropic API key.

```bash
git clone https://github.com/vlmkoa/koan-ai.git
cd koan-ai
npm install

cp .env.example .env.local
# set ANTHROPIC_API_KEY (BACKEND_URL defaults to http://localhost:8000)

npm run backend      # docker compose up -d --build (Postgres + FastAPI)
npm run dev          # http://localhost:3000
```

Create an account at `/signup`, then use the tabs.

Useful backend commands:

```bash
npm run backend:logs   # tail API logs
npm run backend:down   # stop containers (data persists in the volume)
```

> **Antivirus / corporate TLS interception:** if `/koan` fails and the API logs
> show `CERTIFICATE_VERIFY_FAILED`, see [`backend/certs/README.md`](backend/certs/README.md).

### Evals (koan prompt only)

```bash
pip install anthropic
npm run eval
# or: python -X utf8 evals/run.py
# (use python -X utf8 on Windows; python3 resolves to the wrong executable)
```

## Deploy

The frontend is Vercel-ready (`npx vercel`, set `BACKEND_URL`). The backend is
a standard Docker image — deploy `backend/Dockerfile` + a managed Postgres
anywhere containers run (Fly.io, Railway, a VPS), and set `ANTHROPIC_API_KEY`,
`DATABASE_URL`, `FRONTEND_ORIGIN`, `COOKIE_SECURE=1`.

---

## Koan prompt notes

The mirror at `/koan` still follows the **symmetry principle**: push back equally on mainstream and heterodox certainty. Full iteration history, eval methodology, and the 2026 harness correction live in [`CLAUDE.md`](CLAUDE.md) and [`evals/ITERATIONS.md`](evals/ITERATIONS.md).

*Built as a portfolio project exploring LLM behavioral design — now extended into a personal practice app.*
