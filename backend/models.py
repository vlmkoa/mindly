"""ORM models.

Mirrors the former Prisma schema (see ARCHITECTURE.md §7). Conventions:
- string UUID primary keys (generated in Python, no DB extension needed)
- `date` columns are local-calendar strings "YYYY-MM-DD" (the frontend decides
  what "today" means in the user's timezone and sends it explicitly)
- timestamps are timezone-aware UTC
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sessions: Mapped[list["AuthSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class AuthSession(Base):
    """Server-side session; the cookie holds only the opaque `token`."""

    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="sessions")


class MeditationSession(Base):
    __tablename__ = "meditation_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # "free" | "guided"
    duration_sec: Mapped[int] = mapped_column(Integer)
    sound_config: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Addiction(Base):
    __tablename__ = "addictions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(64))   # preset key or "custom"
    label: Mapped[str] = mapped_column(String(255))
    sobriety_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    relapses: Mapped[list["RelapseEvent"]] = relationship(
        back_populates="addiction", cascade="all, delete-orphan", order_by="RelapseEvent.occurred_at"
    )


class RelapseEvent(Base):
    """One row per reset — keeps history so 'longest streak' survives resets."""

    __tablename__ = "relapse_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    addiction_id: Mapped[str] = mapped_column(ForeignKey("addictions.id", ondelete="CASCADE"), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # sobriety_start at the moment of relapse → streak = occurred_at - previous_start
    previous_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    addiction: Mapped[Addiction] = relationship(back_populates="relapses")


class JournalEntry(Base):
    """One entry per user per local calendar day (upserted all day long)."""

    __tablename__ = "journal_entries"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)  # "YYYY-MM-DD"
    mode: Mapped[str] = mapped_column(String(16))  # "free" | "prompted"
    free_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    successes: Mapped[str | None] = mapped_column(Text, nullable=True)
    failures: Mapped[str | None] = mapped_column(Text, nullable=True)
    intentions: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class PlannerTask(Base):
    __tablename__ = "planner_tasks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)  # "YYYY-MM-DD"
    title: Mapped[str] = mapped_column(String(500))
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class KoanSession(Base):
    """Coarse usage tracking for the home-page koan widget."""

    __tablename__ = "koan_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)


class RateCounter(Base):
    """Fixed-window rate-limit counters (see backend/ratelimit.py).

    One row per (key, window_start); `count` is incremented atomically per hit
    via a Postgres UPSERT. Stored in the DB (not process memory) so limits
    survive restarts and hold across multiple backend instances. Stale rows are
    pruned opportunistically by ratelimit._maybe_prune.
    """

    __tablename__ = "rate_counters"
    __table_args__ = (UniqueConstraint("key", "window_start", name="uq_rate_key_window"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    key: Mapped[str] = mapped_column(String(128), index=True)  # e.g. "chat:day:<user_id>"
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
