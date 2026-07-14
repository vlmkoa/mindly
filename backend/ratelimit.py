"""Fixed-window rate limiting, backed by Postgres.

Why Postgres and not in-memory: counters must survive API restarts and stay
consistent if more than one backend instance runs (LAUNCH_PLAN.md item 1).

Model: one `rate_counters` row per (key, window_start). A hit does a Postgres
UPSERT that atomically increments `count` and returns the new value, so
concurrent requests can't race past the cap. Fixed windows can allow up to ~2x
the limit right at a boundary — fine for wallet protection, and far simpler
than a sliding window.

Consumers:
- chat_rate_limited_user  → dependency for POST /api/chat (per-user min + day)
- enforce_ip_limit        → login / signup brute-force + account-farming guard
"""

import random
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

import config
from database import get_db
from models import RateCounter, User, new_id, utcnow
from security import current_user


def _floor(dt: datetime, *, day: bool) -> datetime:
    """Truncate to the start of the current day or minute window."""
    if day:
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return dt.replace(second=0, microsecond=0)


def _hit(db: Session, key: str, window_start: datetime, limit: int) -> bool:
    """Atomically increment the counter for (key, window_start).

    Returns True if this request is within `limit`, False if it exceeds it.
    Rejected requests still increment — harmless for a fixed window that resets.
    """
    stmt = (
        pg_insert(RateCounter)
        .values(id=new_id(), key=key, window_start=window_start, count=1)
        .on_conflict_do_update(
            index_elements=["key", "window_start"],
            set_={"count": RateCounter.count + 1},
        )
        .returning(RateCounter.count)
    )
    count = db.scalar(stmt)
    db.commit()
    return count <= limit


def _maybe_prune(db: Session) -> None:
    """Drop windows older than 2 days ~1% of the time — keeps the table small
    without a scheduler. When item 8's cleanup job lands, move this there."""
    if random.random() < 0.01:
        db.execute(delete(RateCounter).where(RateCounter.window_start < utcnow() - timedelta(days=2)))
        db.commit()


def _client_ip(request: Request) -> str:
    """Best-effort client IP. Behind a proxy (Vercel/Render) the real client is
    the first entry of X-Forwarded-For; fall back to the socket peer locally."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ─── Public helpers ──────────────────────────────────────────────────────────

def enforce_ip_limit(db: Session, request: Request, name: str, limit: int, message: str) -> None:
    """Per-IP-per-minute cap for unauthenticated endpoints (login/signup)."""
    key = f"{name}:min:{_client_ip(request)}"
    if not _hit(db, key, _floor(utcnow(), day=False), limit):
        raise HTTPException(status_code=429, detail=message)
    _maybe_prune(db)


def chat_rate_limited_user(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> User:
    """Drop-in replacement for `current_user` on the chat route: authenticates,
    then enforces the per-user burst (minute) and daily caps before we spend a
    single Anthropic token. Raises 429 when exceeded."""
    now = utcnow()
    if not _hit(db, f"chat:min:{user.id}", _floor(now, day=False), config.CHAT_RATE_PER_MIN):
        raise HTTPException(status_code=429, detail="Slow down — too many messages this minute.")
    if not _hit(db, f"chat:day:{user.id}", _floor(now, day=True), config.CHAT_RATE_PER_DAY):
        raise HTTPException(status_code=429, detail="Daily message limit reached. Try again tomorrow.")
    _maybe_prune(db)
    return user
