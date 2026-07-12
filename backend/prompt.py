"""Parses the koan prompt out of lib/system-prompt.ts.

The TS file remains the single source of truth (production chat, evals, and
this backend all read it). The parsing mirrors evals/run.py, including the
guards that caught the 2026-06 "empty prompt" bug — do not remove them.
"""

import json
import re
from pathlib import Path

# Local dev: backend/ sits next to lib/. In Docker the file is copied to
# /app/lib/system-prompt.ts (see backend/Dockerfile).
_CANDIDATES = [
    Path(__file__).parent.parent / "lib" / "system-prompt.ts",  # repo layout
    Path(__file__).parent / "lib" / "system-prompt.ts",          # docker layout
]


def _read_ts() -> str:
    for p in _CANDIDATES:
        if p.exists():
            return p.read_text(encoding="utf-8")
    raise RuntimeError(
        "lib/system-prompt.ts not found — expected at "
        + " or ".join(str(p) for p in _CANDIDATES)
    )


def load_system_prompt() -> str:
    text = _read_ts()
    # Template literal: first backtick after "SYSTEM_PROMPT =" up to the next
    # backtick (the prompt contains no internal backticks).
    start = text.index("`", text.index("SYSTEM_PROMPT =")) + 1
    end = text.index("`", start)
    return text[start:end]


def load_few_shot_exemplars() -> list[dict]:
    text = _read_ts()
    m = re.search(r"FEW_SHOT_EXEMPLARS[^=]*=\s*\[(.*?)\];", text, re.DOTALL)
    if not m:
        raise RuntimeError("FEW_SHOT_EXEMPLARS not found in system-prompt.ts")
    body = m.group(1)
    pattern = re.compile(
        r'\{\s*role:\s*"(user|assistant)"\s*,\s*content:\s*"((?:[^"\\]|\\.)*)"\s*\}'
    )
    out = []
    for role, content in pattern.findall(body):
        # json.loads handles TS double-quoted escapes and preserves non-ASCII
        # (unicode_escape would mojibake the em-dashes — see evals/run.py).
        out.append({"role": role, "content": json.loads(f'"{content}"')})
    return out


SYSTEM_PROMPT = load_system_prompt()
FEW_SHOT_EXEMPLARS = load_few_shot_exemplars()

# Guard against silent parse regressions (the v3–v9 eval bug class).
if len(SYSTEM_PROMPT) < 500:
    raise RuntimeError(
        f"Parsed SYSTEM_PROMPT is only {len(SYSTEM_PROMPT)} chars — the "
        "template delimiters in lib/system-prompt.ts probably changed."
    )
if len(FEW_SHOT_EXEMPLARS) < 2:
    raise RuntimeError("Parsed fewer than 2 few-shot exemplars — parser broken?")
