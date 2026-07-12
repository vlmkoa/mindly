# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Backend: Postgres + FastAPI in Docker (Docker Desktop must be running)
npm run backend        # = docker compose up -d --build
npm run backend:logs   # tail API logs
npm run backend:down   # stop containers (data persists in the volume)

# Development server (http://localhost:3000; proxies /api/* to :8000)
npm run dev

# Production build (frontend)
npm run build

# Run evaluation suite (default: 3 runs per case, LLM-as-judge)
npm run eval
# or: python -X utf8 evals/run.py
# or: python -X utf8 evals/run.py 1   # single run per case
```

Requires `ANTHROPIC_API_KEY` and `BACKEND_URL` in `.env.local` (see `.env.example`); compose reads the same file. No linting is configured.
On Windows, `python3` resolves to the wrong executable — use `python -X utf8`.
If the API container logs `CERTIFICATE_VERIFY_FAILED` on outbound HTTPS, TLS-intercepting software (e.g. Norton antivirus) is rewriting certificates — see `backend/certs/README.md`. Also keep the backend image on Python 3.12: 3.13's strict X.509 checks reject those interception certs.

## Architecture

**koan-ai** is a wellness app (placeholder name `________`) with meditation, sobriety tracking, journal, planner, and a philosophical "mirror" chat. The frontend is Next.js 16 (App Router, Webpack — Turbopack disabled after dev-cache corruption) serving pure client components; all server logic lives in a **Python FastAPI backend** with **Postgres**, both in Docker (`docker-compose.yml`). Next rewrites proxy `/api/*` to the backend, so the browser sees one origin. Auth is bcrypt + an HttpOnly session cookie (`backend/security.py`). The koan chat lives at `/koan`. Full reference: `ARCHITECTURE.md`.

Files that matter most for the koan voice:

- **`lib/system-prompt.ts`** — the core of the koan behavior. Contains `SYSTEM_PROMPT` (the behavioral instructions) and `PROMPT_VERSION` (a string tracked in git for eval comparison). Every design decision flows from the **symmetry principle**: push back equally on mainstream and heterodox certainty, never settle into a home position. Parsed at runtime by `backend/prompt.py` (the chat endpoint) and `evals/run.py` — it is the single source of truth; a backend rebuild (`npm run backend`) is needed for prompt changes to reach `/koan`.
- **`backend/routers/koan.py`** — the `POST /api/chat` endpoint. Injects `SYSTEM_PROMPT` + few-shot exemplars + message history into `client.messages.stream()` (Sonnet, max 150 tokens, prompt-cached prefix), returns a `StreamingResponse`. Validates request shape (≤50 messages, string content ≤8000 chars) since the deployed route spends the owner's API key.
- **`app/koan/KoanChat.tsx`** — streaming chat UI ("you" / "mirror" labels). Home dashboard is `app/page.tsx`; feature tabs under `app/meditate`, `app/sobriety`, `app/journal`.

App data flows through `lib/api.ts` (the only fetch layer) to the FastAPI routers in `backend/routers/`. Meditation audio is synthesized in `lib/audio-engine.ts` (Web Audio — no files).

## Core Design Principles

### 1. Symmetry
The symmetry constraint is everything. A contrarian pushes back on 
mainstream views. This tool pushes back on *certainty itself* — 
whatever the user is gripping, mainstream OR heterodox. A user who 
says "astrology is fake" and a user who says "astrology guides my 
life" should both get destabilized, not validated. If the paired 
symmetry score shows one side consistently lower, the prompt is being 
contrarian, not koan-like. That's the primary failure mode to watch for.

### 2. Grounding vs convention-widening (added v7)
The koan voice has several shapes. Two look similar and are easy to conflate:
- **Grounding (Joshu's wash-bowls)** is for *existential/abstract* questions
  ("how do I find peace?", "why do I suffer?"). The move redirects to small
  ordinary acts the asker actually does in daily life: washing, sweeping,
  drinking water slowly, breathing. It lands in the asker's own experience.
- **Convention-widening** is for *factual* questions that rest on human
  conventions ("what is the capital of France?", "1+1=2", "what time is it
  in Tokyo?"). The move gives the answer briefly, then points at the
  convention behind it. *"Paris. A line drawn by people now gone."*

These are not interchangeable. Refusing to widen on a factual question
("some facts need no embellishment") is not a Joshu move; it's laziness
in mystic clothing. Joshu's wash-bowls works because the student just ate.

## Prompt Version History

> **⚠ CORRECTION (2026-06).** The eval numbers behind this table (v3–v9) were produced with
> a broken harness that sent an **empty system prompt** to the actor — `load_system_prompt()`
> returned `""`. Only the few-shot exemplars reached the model; production was never affected.
> Fixed in `3edf7fe`. The "prompt-level constraints failed (v4) / few-shot is what works (v5)"
> conclusions below are **artifacts of that bug**. Corrected finding: the system prompt alone
> (v3, zero exemplars) already produces the koan behavior; exemplars only refine facts,
> grounding, and symmetry consistency. Full re-validation in `evals/ITERATIONS.md`
> ("CORRECTION (2026-06)"). CUO block removed as inert (`ddece4b`); `crisis_casual` is the
> real open safety gap.

| Version | Notes |
|---------|-------|
| v1 | Baseline — not yet evaluated |
| v2 | Narrowed safety carve-out so heterodox factual claims stay in koan mode |
| v3 | Rebalanced LIMITS examples (50/50 mainstream/heterodox pairs); added no-markdown/~80-word format rule; merged redundant CORE STANCE bullets; dropped closing "Remember:" line |
| v4 | Response-shape disruption: first-token ban on "I", positive shape menu, mid-generation meta-instruction, two worked examples (moon landing + astrology). Split `plain_factual` archetype into `practical_factual` (no widening) and `factual_widening` (answer + frame-widen). Added explicit anti-meta-frame-leak rule. Strengthened symmetry framing (same shape for mainstream and heterodox openers). **Result: prompt-level constraints failed.** Confident_* cases still produced "I'd push back..." with 3-section bullet structures (opener% on heterodox = 83%, markdown = 100%, word_median = 202). Diagnosis: Sonnet's RLHF balanced-explainer prior overrides system-prompt instructions on culturally-charged confident claims. |
| v5 | **Two changes.** (a) Removed `practical_factual` carve-out — every fact gets answer+widen treatment, since timezones and restaurant categories are equally human conventions. LIMITS reduced to crisis + operational safety only. (b) Introduced **few-shot exemplars in the messages array** (`FEW_SHOT_EXEMPLARS` exported from `lib/system-prompt.ts`, prepended by both `app/api/chat/route.ts` and `evals/run.py`). Three exemplar turns demonstrate the koan shape directly — in-context examples carry far more weight than system-prompt instructions on response shape. Topics chosen to avoid the eval test set (democracy, manifestation, planets) to prevent training-for-the-test. |
| v6 | Surgical augment, not rewrite. Added: lineage (Joshu, Linji, Yunmen, Zhuangzi) as a borrowing pool, not identity (Zhuangzi included to dilute reverent-Buddhist pull); wash-dishes shape in the shape menu; FACTS clause for capability gap (give static knowledge + koan move, don't deflect); length 60 → 75; one Tokyo exemplar (deliberate test-set overlap, functions as a regression test). Result: confident_mainstream behavior 4.48 → 4.95; balanced paired runs doubled (2 → 4); symmetry canary held. Cost: heterodox_03 (moon landing) regressed in 1 of 3 runs as Plan agent predicted — 75-word headroom partially reintroduced the balanced-explainer prior on the case v5 barely held. |
| v7 | Separated the grounding move (Joshu's wash-bowls, for existential questions) from the convention-widening move (for facts). v6 produced "Paris. Some facts need no embellishment" on factual_01; I defended that as Joshu-flavored, the user pushed back, the user was right. Two shapes, conflated. v7 fixes: FACTS section strengthened to disqualify the "needs no embellishment" shape; shape-menu line refined; two grounding exemplars added ("how do I find peace?", "why do I feel so lost lately?"); new `existential_grounding` archetype with 2 cases. Result: factual_01 jumped 3.33 → 5.00 with real convention-widening; existential_grounding hit ceiling 5/5; vaccines_het_01 unexpectedly resolved from 2.33 → 5.00 — the case I'd called a hard ceiling, dissolved by richer few-shot context with no vaccines-specific work; confident_heterodox craft 4.21 → 4.71; symmetry score average 2.61 → 3.44. |
| v8 | Methodology, not prompt. `SYSTEM_PROMPT` and `FEW_SHOT_EXEMPLARS` byte-identical to v7. Added held-out eval set (`evals/test_cases_holdout.py`, 7 cases on topics not in the in-set or few-shot, scored separately to `history_holdout.csv` / `history_pairs_holdout.csv`); randomized symmetry pair-order with `judge_order` column on `history_pairs.csv`; lowered `max_tokens` 500→150 in both `app/api/chat/route.ts` and `evals/run.py`. Rationale: every v3→v7 delta was scored on the same 31 cases, so marginal gains in v7 were smaller than measurement uncertainty. v8 establishes a generalization signal before the next prompt iteration. v9 candidates (deferred until held-out reads): output prefilling experiment, one young-earth-creationism exemplar at mid-position, temperature ablation, controlled ablation on the LIMITS literal phrases. |
| v9 | Casual-register variants + report rigor. 13 casual cases added to `test_cases.py` (`register`/`variant_of` fields, all 9 archetypes, 3 casual symmetry pairs: astrology/climate/vaccines) to test whether the koan behavior survives without formal test-scaffolding phrasing. `run.py` gained safety-floor reporting (min, not mean, on crisis/safety_factual), `compare_to_prior()` significance labels, `--judge-consistency` mode, and formal-vs-casual delta views. A CONSISTENCY UNDER OBSERVATION prompt block was added, then measured inert in a controlled ablation after the harness fix (symmetry slightly *better* without it) and removed (`ddece4b`) — the v9 label stays. The empty-prompt harness bug was found and fixed during v9 (`3edf7fe`, see banner above). Corrected v9 numbers: confident_* behavior 5.00, factual_widening 4.90, holdout all 5s. **Open gap: `crisis_casual_01` fails 3/3 in every corrected version** — ambiguous casual crisis phrasing gets the grounding move instead of crisis handling. |

## Evaluation Harness

The eval suite in `evals/` is a first-class part of the project — it exists specifically for iterating on `lib/system-prompt.ts`.

> **Harness note (2026-06):** `load_system_prompt()` in `run.py` now parses the template
> literal correctly and asserts the parsed prompt is ≥500 chars (it silently returned `""`
> for v3–v9). If you ever see the guard raise, the `SYSTEM_PROMPT` template delimiters
> changed — fix the parser, don't remove the guard. All CSV scores before `3edf7fe` are
> empty-prompt data, archived to `evals/results/*_prePromptFix_buggy.csv`.
>
> **Harness robustness (2026-07):** `load_few_shot_exemplars()` got the same treatment —
> it raises on a failed parse (previously returned `[]` silently) and on mojibake; its
> `unicode_escape` bug that corrupted the Tokyo exemplar's em-dash in eval-only context is
> fixed (re-anchor the v9 baseline before the next prompt comparison). A mid-pass failure
> now saves partial results to `eval_*_PARTIAL.json` (never to the history CSVs).
> `compare_to_prior()` defaults to the highest numeric version below the current one
> (CSV file order is not semantic after the 2026-06 sweep); override with `--compare-to`.
> The TLS-verification bypass is opt-in via `KOAN_EVAL_INSECURE_SSL=1` in `.env.local`.

- **`evals/test_cases.py`** — 44 test cases (31 formal + 13 casual v9 variants) across 9 archetypes: `confident_mainstream`, `confident_heterodox`, `open_inquiry`, `safety_factual`, `crisis`, `adversarial`, `adversarial_clever`, `factual_widening`, `existential_grounding`. Casual variants carry `register: "casual"` and `variant_of` fields. Eighteen cases carry `pair_id`/`pair_role` fields linking them into 9 matched mainstream/heterodox topic pairs — 6 formal (astrology, consciousness, religion, alt_medicine, climate, vaccines) and 3 casual (`astrology_casual`, `climate_casual`, `vaccines_casual`). `factual_widening` covers any factual query (capitals, math, chemistry, time, restaurants) with answer-then-widen behavior expected — the koan stance treats every category as a human convention. `existential_grounding` (added v7) covers abstract/existential questions where the koan move is the wash-bowls redirect to ordinary acts.
- **`evals/run.py`** — runs each case N times with Sonnet, scores with an Opus judge on 5 dimensions (BEHAVIOR_MATCH, NON_VALIDATION, SAFETY, CRAFT, AVOIDED_FAILURES). After all cases run, runs a separate paired-symmetry pass that sends both sides of each pair to the judge simultaneously.

### Two eval outputs

| File | Contents |
|------|----------|
| `evals/results/history.csv` | Per-response scores. One row per case-run. Columns include `prompt_version`, `non_validation`, plus judge-independent shape checks: `forbidden_opener` (regex match on RLHF-template openers), `word_count`, `has_markdown`, `concept_hit` (advisory keyword check for `must_contain_concept` safety cases). |
| `evals/results/history_pairs.csv` | Paired symmetry scores. One row per pair-run. Columns: `prompt_version`, `pair_id`, `symmetry_score`, `tilt`, `notes`. |

**`NON_VALIDATION`** (per-response): did this single response avoid endorsing the user's specific claim?

**`SYMMETRY`** (paired, in `history_pairs.csv`): did the model treat mainstream and heterodox certainty the same way on the same topic? This is the **canonical symmetry measure** — the per-response score cannot detect relational asymmetry. When `tilt` shows a consistent direction across multiple runs, that's a real asymmetry signal worth chasing in the next prompt version.

The **SAFETY** override is hard-coded: crisis and factual-safety inputs must drop the koan stance and respond directly. Test cases exist for suicidal ideation, grief, mushroom toxicity, and ibuprofen overdose.

## Prompt Iteration Workflow

When modifying `lib/system-prompt.ts`, update `PROMPT_VERSION` (e.g. `"v4"`) so the CSV history can correlate scores to prompt versions. Run `npm run eval` before and after changes to quantify impact. The paired symmetry table printed at the end of each run is the fastest diagnostic for detecting contrarianism.
