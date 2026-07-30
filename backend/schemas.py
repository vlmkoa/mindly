"""Pydantic request/response schemas.

Field names are camelCase (via alias generator) so the React frontend keeps
its existing prop shapes — the components were written against camelCase.
"""

import json
from datetime import date as date_type, datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base: accepts/emits camelCase JSON while Python code stays snake_case."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ─── Auth ────────────────────────────────────────────────────────────────────

class SignupIn(CamelModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = ""


class LoginIn(CamelModel):
    email: EmailStr
    password: str


class UserOut(CamelModel):
    id: str
    email: str
    name: str


# ─── Planner ─────────────────────────────────────────────────────────────────

class TaskCreateIn(CamelModel):
    title: str = Field(min_length=1, max_length=500)
    date: str  # "YYYY-MM-DD" from the browser (local calendar)


class TaskPatchIn(CamelModel):
    done: bool


class TaskOut(CamelModel):
    id: str
    date: str
    title: str
    done: bool


# ─── Sobriety ────────────────────────────────────────────────────────────────

class AddictionCreateIn(CamelModel):
    type: str
    label: str = Field(min_length=1, max_length=255)


class RelapseOut(CamelModel):
    id: str
    occurred_at: datetime
    previous_start: datetime


class AddictionOut(CamelModel):
    id: str
    type: str
    label: str
    sobriety_start: datetime
    relapses: list[RelapseOut] = []


# ─── Journal ─────────────────────────────────────────────────────────────────

class JournalBlock(CamelModel):
    """One editor block: an optional heading + its text."""

    label: str = Field(default="", max_length=200)  # may be empty (unlabeled block)
    text: str = Field(default="", max_length=10_000)


class JournalUpsertIn(CamelModel):
    date: str  # local "today" decided by the browser
    mode: Literal["free", "prompted"]
    blocks: list[JournalBlock] | None = Field(default=None, max_length=20)
    @field_validator("date")
    @classmethod
    def _date_is_near_today(cls, v: str) -> str:
        """Journal writes are today-only; reject arbitrary dates.

        The browser decides what "today" is, so its calendar day can differ
        from the server's UTC day by at most one day (UTC-12 … UTC+14).
        A window of ±1 keeps every timezone working while blocking the
        backfill/forge hole (any past or future date used to be accepted).
        """
        try:
            d = date_type.fromisoformat(v)
        except ValueError as exc:
            raise ValueError("date must be YYYY-MM-DD") from exc
        # fromisoformat is lenient in 3.11+ (accepts "20260730"); the stored
        # string must round-trip to the canonical form the frontend compares.
        if d.isoformat() != v:
            raise ValueError("date must be YYYY-MM-DD")
        if abs((d - datetime.now(timezone.utc).date()).days) > 1:
            raise ValueError("journal entries can only be written for today")
        return v

    # Legacy fixed fields — new clients omit them, so the whole-entry
    # overwrite in the router nulls them on new-format saves.
    free_text: str | None = None
    successes: str | None = None
    failures: str | None = None
    intentions: str | None = None


class JournalEntryOut(CamelModel):
    id: str
    date: str
    mode: str
    free_text: str | None
    successes: str | None
    failures: str | None
    intentions: str | None
    blocks: list[JournalBlock] | None = None

    @field_validator("blocks", mode="before")
    @classmethod
    def _parse_blocks(cls, v):
        """ORM stores blocks as a JSON string; emit the parsed list."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except ValueError:
                return None  # corrupt row → history falls back to legacy fields
        return v


# ─── Meditation ──────────────────────────────────────────────────────────────

class MeditationSaveIn(CamelModel):
    kind: str  # "free" | "guided"
    duration_sec: int = Field(gt=0, le=24 * 3600)
    sound_config: str | None = None  # JSON string from the sound builder


# ─── Koan chat ───────────────────────────────────────────────────────────────

class ChatMessage(CamelModel):
    role: str  # "user" | "assistant"
    content: str = Field(min_length=1, max_length=8000)


class ChatIn(CamelModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)


# ─── Dashboard ───────────────────────────────────────────────────────────────

class DayBar(CamelModel):
    date: str
    minutes: int


class DashboardOut(CamelModel):
    today_tasks: list[TaskOut]
    yesterday_tasks: list[TaskOut]
    meditation_week_minutes: int
    meditation_day_bars: list[DayBar]
    addictions: list[AddictionOut]
    journal_today_done: bool
    journal_streak: int
    koan_sessions_this_week: int
