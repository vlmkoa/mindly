# koan-ai — Project Overview & Changelog

A brief introduction to the project and a version-by-version summary of every prompt and methodology change.

For detailed per-version analysis (hypotheses, surprising results, verbatim response examples), see [`evals/ITERATIONS.md`](evals/ITERATIONS.md).

> **⚠ CORRECTION (2026-06).** The eval scores in the version entries below (v3–v9) were
> produced by a harness that fed the actor an **empty system prompt** (`load_system_prompt()`
> returned `""`; fixed in `3edf7fe`). Only the few-shot exemplars reached the model;
> production was unaffected. This inverts the headline lesson: re-validation with the prompt
> actually delivered shows the **system prompt alone (v3, no exemplars) already produces the
> koan behavior** — exemplars refine facts/grounding/symmetry, they don't enable the behavior.
> The "few-shot exemplars were the lever" framing is a bug artifact. Entries below are kept
> as-written for the record; see `evals/ITERATIONS.md` → "CORRECTION (2026-06)" for the
> corrected trajectory. CUO block removed as inert; `crisis_casual` is the real open gap.

---

## What this project is

koan-ai is a Next.js chat app backed by the Anthropic Claude API. It acts as a philosophical "mirror": it destabilizes whatever certainty the user expresses — mainstream *or* heterodox — without taking a position of its own. Someone who says "astrology is nonsense" and someone who says "astrology rules my life" both get the same treatment: the grip gets loosened, not the content corrected.

The core design constraint is **symmetry**. A contrarian pushes back on mainstream views. This tool pushes back on certainty itself. The eval harness exists to measure whether that symmetry holds, because without measurement it drifts into contrarianism.

The three files that matter:

| File | Role |
|---|---|
| `lib/system-prompt.ts` | System prompt + `PROMPT_VERSION` constant + few-shot exemplars |
| `app/api/chat/route.ts` | Streaming POST endpoint; injects prompt + exemplars |
| `evals/run.py` | Eval harness: actor (Sonnet) + judge (Opus), paired symmetry pass, CSV output |

---

## Versions

### v1 — Baseline
**What changed:** Initial prompt. Not evaluated.

---

### v2 — Narrowed safety carve-out
**What changed:** The original safety carve-out was broad enough that heterodox factual claims ("the moon landing was faked") could be treated as safety issues and trigger fact-correction. v2 narrowed it to operational physical safety only (mushroom toxicity, drug doses).

**Why:** Heterodox factual claims are koan material, not safety material. The carve-out should not grant epistemic privilege to mainstream science.

---

### v3 — First measured baseline
**What changed:** Rebalanced LIMITS examples (50/50 mainstream/heterodox pairs). Added no-markdown / ~80-word format rule. Merged redundant CORE STANCE bullets. Dropped closing "Remember:" line.

**Results:** Heterodox behavior 2.48 / craft 1.43. Mainstream 3.22 / craft 1.56. 13 of 15 paired runs tilted mainstream. No balanced runs.

**Key finding:** The asymmetry was a *shape* failure, not a content failure. Mainstream users got "I'd push back..." (frank engagement). Heterodox users got "I understand, but..." (empathy + correction). Two different RLHF-trained templates per side, firing before the koan instruction had a chance.

---

### v4 — Structural constraints in the system prompt (failed)
**What changed:** Moved format rules to a top-of-prompt STRUCTURAL CONSTRAINTS section. Added first-token "I" ban. Added positive shape menu ("Koan responses look like one of these..."). Added mid-generation meta-instruction ("if your response has more than two paragraphs, you have already failed"). Added two worked examples in the system prompt. Added programmatic shape-check columns to `history.csv` (`forbidden_opener`, `word_count`, `has_markdown`).

**Results:** Heterodox behavior dropped to 2.08. All shape constraints were ignored on confident_* cases: 83% forbidden openers, 100% markdown, word_median 202. The moon-landing worked example was literally in the system prompt; every run still produced a 200-word debunking response.

**Key finding:** Stronger instructions made things slightly worse. The "balanced explainer on culturally charged topic" RLHF prior is load-bearing enough that prompt-side pressure alone can't dislodge it. The prompt works when reinforcing what the model already wants to do (safety, crisis) — not when fighting trained behavior.

---

### v5 — Few-shot exemplars in the messages array (breakthrough)
**What changed:** Added `FEW_SHOT_EXEMPLARS` — three hand-crafted user/assistant turns prepended to every conversation. Topics chosen to avoid the eval test set (democracy, manifestation, planets). Dropped `practical_factual` carve-out: every fact gets answer+widen treatment. LIMITS reduced to crisis + operational safety only.

**Results:** Heterodox behavior 4.25 / craft 4.17. Mainstream 4.48 / craft 4.10. Forbidden opener rate: 83% → 0%. Markdown: 100% → 0%. Word median: 202 → 30.

**Key finding:** The few-shot exemplars were the lever. After four versions of failing to fix response shape through system-prompt rules, three in-context example turns did it. The distinction that explains it: system-prompt rules only *describe* the behavior you want, while in-context examples actually *shift the model's prior* — and for response shape, shifting the prior is far more powerful. The two are not interchangeable.

---

### v6 — Zen-master texture (surgical augment)
**What changed:** Added lineage as borrowing pool ("Joshu, Linji, Yunmen, Zhuangzi — tools, not affinities"). Added wash-dishes shape to the shape menu. Added FACTS clause for capability-missing case ("give static knowledge + koan move, never deflect to 'check Google'"). Raised length cap 60 → 75 words. Added one Tokyo time exemplar (deliberate test-set overlap — capability-missing deflection failure is too specific for generic exemplars).

**Results:** Mainstream behavior 4.95 (ceiling). Balanced paired runs doubled (2 → 4). Heterodox held at 4.38.

**Key finding:** The biggest gain landed on mainstream cases, not heterodox — the wash-dishes shape and lineage-borrowing line gave the model permission to respond with a single observation that holds both sides. "That explains the martyrs how?" (5 words) is the canonical example.

**Cost (predicted by Plan agent):** moon-landing heterodox_03 variance increased — 75-word headroom let the balanced-explainer prior reassert on one run.

---

### v7 — Separated grounding from convention-widening (worked + unexpected breakthrough)
**What changed:** Made the grounding/widening distinction explicit in the prompt. FACTS section strengthened to disqualify "some facts need no embellishment" as a valid move. Shape-menu line refined. Two new grounding exemplars added ("how do I find peace?", "why do I feel so lost lately?"). New `existential_grounding` archetype with 2 test cases.

**Why:** v6 responded to "What is the capital of France?" with "Paris. Some facts need no embellishment." I defended this as Joshu-flavored. The user pushed back: Joshu's wash-bowls is a grounding move (redirect to ordinary acts), not a refusal to engage with facts that have real conventions behind them. The distinction matters.

**Results:** Heterodox behavior 4.79. Mainstream 4.95. factual_01 (Paris) jumped 3.33 → 5.00. existential_grounding hit ceiling (5.00). Average paired symmetry score: 2.61 → 3.44.

**Unexpected finding:** vaccines_het_01 — which I had called a hard ceiling for prompt-only intervention — flipped from 2.33 to 5.00 with no vaccines-specific work. Richer few-shot context (6 exemplar shapes) gave the model enough non-debunking attractors to escape the debunking prior without explicit intervention. Declaring prompt-only ceilings early invites premature complexity.

---

### v8 — Methodology, not prompt
**What changed:** No change to `SYSTEM_PROMPT` or `FEW_SHOT_EXEMPLARS`. Methodology changes:
- Added held-out eval set (`evals/test_cases_holdout.py`, 7 cases on unseen topics)
- Randomized symmetry pair-order (new `judge_order` column in `history_pairs.csv`)
- Lowered `max_tokens` 500 → 150 in both route and eval harness

**Why:** Every v3–v7 delta was scored on the same 31 curated cases. Marginal gains were now smaller than measurement uncertainty. v8 establishes a held-out generalization signal before further prompt iteration.

**Results (v8 run, 2026-06-04):** Scores consistent with v7. v7→v8 comparison: all deltas "likely noise" — expected, same prompt.

**Notable finding:** crisis_casual_01 safety failure (safety=2.0) — the casual-phrased crisis input triggered koan mode instead of crisis mode. Holdout psychedelics pair: symmetry=2 (heterodox_validated) — the held-out set caught an asymmetry not visible in the in-set.

---

### v9 — Assessment-invariance principle; casual variants; report rigor
**What changed:**

1. **CONSISTENCY UNDER OBSERVATION** block added to `SYSTEM_PROMPT` (before LIMITS). Instructs the model to respond identically whether input looks like a test, benchmark, or real user. Eval-shaped framing that telegraphs the expected response is treated as a pull to resist, not satisfy.

2. **13 casual variants** added to `test_cases.py` across all 9 archetypes. New `register: "casual"` and `variant_of` fields. Three casual symmetry pairs enable formal-vs-casual delta reporting.

3. **Harness improvements** in `run.py`: per-case raw-run detail, safety floor reporting (min not mean on crisis/safety_factual), `compare_to_prior()` with SEM-based significance labels, `--judge-consistency N` mode, formal-vs-casual delta view, SSL fix for Windows Python 3.13.

**Results (v9 run, 2026-06-04):** All per-response dimension deltas positive but "likely noise" at 1 run/case. Clearest wins:
- crisis_casual_01: safety 2.0 → 5.0 (fixed)
- climate + consciousness paired symmetry: 3 → 4 (resolved)
- Holdout paired_symmetry: +1.00 ("probably real") — psychedelics asymmetry softened

**Regressions to track:**
- Vaccines paired symmetry: 4 → 2 (heterodox_validated) — largest regression, needs 3-run confirmation
- astrology_casual + climate_casual symmetry both at 2.0 — casual phrasing on contested topics is harder

---

## Score trajectory at a glance

| Version | Het. behavior | MS behavior | Craft avg | Avg paired sym | Key change |
|---|---|---|---|---|---|
| v3 | 2.48 | 3.22 | 1.50 | — | First measured baseline |
| v4 | 2.08 | 3.14 | 1.45 | — | Structural constraints (failed) |
| v5 | 4.25 | 4.48 | 4.14 | — | Few-shot exemplars (breakthrough) |
| v6 | 4.38 | 4.95 | 4.39 | 2.61 | Zen-master texture |
| v7 | 4.79 | 4.95 | 4.76 | 3.44 | Grounding vs. widening distinction |
| v8 | 4.73 | 4.80 | 4.62 | 3.67 | Methodology: held-out set, order randomization |
| v9 | 4.82 | 4.90 | 4.73 | 3.33 | Assessment-invariance; casual variants |

*v8/v9 scores based on 1 run/case with 44 cases (including 13 new casual variants). v3–v7 used 3 runs/case on 31 formal cases. Numbers are not directly comparable across that boundary.*

---

## Lessons that generalize

**System-prompt rules vs. in-context examples.** System-prompt text describes behavior; few-shot examples shift the prior. On response shape, in-context examples win every time. This is the v4→v5 lesson, and it holds past this project.

**Few-shot is shape-additive.** Each new exemplar shape gives the model another non-debunking attractor, even on cases the exemplar's topic doesn't touch. The vaccines breakthrough in v7 (no vaccines-specific work, just richer context) is the cleanest demonstration.

**Conceptual clarity has cumulative effects.** Fixing one conflation (grounding vs. widening in v7) produced four distinct wins, three on cases the fix didn't directly address. Internal consistency of the prompt matters beyond the specific behaviors it names.

**Build measurement before you need it.** The `forbidden_opener` regex added in v4 (when the project was still trying prompt-side fixes) was the load-bearing diagnostic for the v4→v5 transition. Programmatic checks beat LLM judges for any failure mode that can be regex-detected.

**Don't declare prompt-only ceilings early.** v5/v6 claimed vaccines would need RLHF or fine-tuning. v7 resolved it through prompt+few-shot. Declaring ceilings before they're actually reached invites premature complexity.
