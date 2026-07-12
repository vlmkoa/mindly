"""Pydantic request/response schemas.

Field names are camelCase (via alias generator) so the React frontend keeps
its existing prop shapes — the components were written against camelCase.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field
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

class JournalUpsertIn(CamelModel):
    date: str  # local "today" decided by the browser
    mode: str  # "free" | "prompted"
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
