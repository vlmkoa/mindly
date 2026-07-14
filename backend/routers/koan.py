"""Koan chat: streams Claude through the backend + session usage tracking.

Mirrors the old app/api/chat/route.ts:
- request-shape limits (≤50 messages, ≤8000 chars each) because this endpoint
  spends the owner's Anthropic API key
- few-shot exemplars prepended, last one carries a cache breakpoint so the
  stable prefix is prompt-cached across requests
- plain-text chunked streaming to the browser
"""

from datetime import timedelta

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from database import get_db
from models import KoanSession, User, utcnow
from prompt import FEW_SHOT_EXEMPLARS, SYSTEM_PROMPT
from ratelimit import chat_rate_limited_user
from schemas import ChatIn
from security import current_user

router = APIRouter(prefix="/api", tags=["koan"])


def _cached_exemplars() -> list[dict]:
    """Few-shots with a cache_control breakpoint on the final turn."""
    out: list[dict] = []
    for i, m in enumerate(FEW_SHOT_EXEMPLARS):
        if i == len(FEW_SHOT_EXEMPLARS) - 1:
            out.append(
                {
                    "role": m["role"],
                    "content": [
                        {
                            "type": "text",
                            "text": m["content"],
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                }
            )
        else:
            out.append(m)
    return out


@router.post("/chat")
def chat(body: ChatIn, user: User = Depends(chat_rate_limited_user)):
    if not config.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    for m in body.messages:
        if m.role not in ("user", "assistant"):
            raise HTTPException(status_code=400, detail="Invalid role")

    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

    def generate():
        # The context manager aborts the upstream stream if the client
        # disconnects, so we stop paying for tokens nobody reads.
        with client.messages.stream(
            model="claude-sonnet-4-5",
            max_tokens=150,
            system=SYSTEM_PROMPT,
            messages=_cached_exemplars()
            + [{"role": m.role, "content": m.content} for m in body.messages],
        ) as stream:
            for text in stream.text_stream:
                yield text
            # Log real token usage so we can replace the LAUNCH_PLAN cost
            # estimates with actual numbers (visible in `docker compose logs api`).
            u = stream.get_final_message().usage
            print(
                f"[koan usage] user={user.id} in={u.input_tokens} "
                f"cache_read={getattr(u, 'cache_read_input_tokens', 0)} "
                f"cache_write={getattr(u, 'cache_creation_input_tokens', 0)} "
                f"out={u.output_tokens}",
                flush=True,
            )

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")


@router.post("/koan/bump")
def bump_session(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Usage tracking for the home widget: one 'session' per rolling hour."""
    since = utcnow() - timedelta(hours=1)
    recent = db.scalar(
        select(KoanSession)
        .where(KoanSession.user_id == user.id, KoanSession.started_at >= since)
        .order_by(KoanSession.started_at.desc())
    )
    if recent:
        recent.message_count += 1
    else:
        db.add(KoanSession(user_id=user.id, message_count=1))
    db.commit()
    return {"ok": True}
