"""Home dashboard aggregation — one call returns everything the page needs.

Date/time convention: the browser sends its local `today` ("YYYY-MM-DD") and
timezone offset so streaks and day-bars align with the user's calendar, not
the server's.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Addiction, JournalEntry, KoanSession, MeditationSession, PlannerTask, User
from schemas import DashboardOut, DayBar
from security import current_user

router = APIRouter(prefix="/api", tags=["dashboard"])


def _parse_day(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d")


def _day_key(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    today: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"),
    tz_offset_min: int = Query(default=0, ge=-840, le=840),  # JS getTimezoneOffset()
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    today_dt = _parse_day(today)
    yesterday = _day_key(today_dt - timedelta(days=1))

    # Start of the user's local week (Sunday), expressed in UTC for the
    # timestamp comparisons. JS getTimezoneOffset() is minutes *behind* UTC.
    week_start_local = today_dt - timedelta(days=(today_dt.weekday() + 1) % 7)
    week_start_utc = week_start_local.replace(tzinfo=timezone.utc) + timedelta(minutes=tz_offset_min)

    today_tasks = db.scalars(
        select(PlannerTask)
        .where(PlannerTask.user_id == user.id, PlannerTask.date == today)
        .order_by(PlannerTask.created_at)
    ).all()

    yesterday_tasks = db.scalars(
        select(PlannerTask)
        .where(PlannerTask.user_id == user.id, PlannerTask.date == yesterday, PlannerTask.done.is_(False))
        .order_by(PlannerTask.created_at)
    ).all()

    meditations = db.scalars(
        select(MeditationSession)
        .where(MeditationSession.user_id == user.id, MeditationSession.completed_at >= week_start_utc)
        .order_by(MeditationSession.completed_at)
    ).all()

    addictions = db.scalars(
        select(Addiction)
        .where(Addiction.user_id == user.id, Addiction.active.is_(True))
        .order_by(Addiction.created_at)
    ).all()

    journal_dates = set(
        db.scalars(
            select(JournalEntry.date).where(JournalEntry.user_id == user.id)
        ).all()
    )

    koan_count = len(
        db.scalars(
            select(KoanSession.id).where(
                KoanSession.user_id == user.id, KoanSession.started_at >= week_start_utc
            )
        ).all()
    )

    # 7-day meditation bars, bucketed by the user's local day.
    day_bars: list[DayBar] = []
    for i in range(7):
        day = week_start_local + timedelta(days=i)
        key = _day_key(day)
        minutes = sum(
            m.duration_sec / 60
            for m in meditations
            # Convert stored UTC timestamp to the user's local day bucket.
            if _day_key(m.completed_at - timedelta(minutes=tz_offset_min)) == key
        )
        day_bars.append(DayBar(date=key, minutes=round(minutes)))
    week_minutes = sum(b.minutes for b in day_bars)

    # Journal streak: consecutive days ending today (or yesterday if today
    # isn't written yet).
    streak = 0
    cursor = today_dt if today in journal_dates else (
        today_dt - timedelta(days=1) if yesterday in journal_dates else None
    )
    while cursor is not None and _day_key(cursor) in journal_dates:
        streak += 1
        cursor = cursor - timedelta(days=1)

    return DashboardOut(
        today_tasks=today_tasks,
        yesterday_tasks=yesterday_tasks,
        meditation_week_minutes=week_minutes,
        meditation_day_bars=day_bars,
        addictions=addictions,
        journal_today_done=today in journal_dates,
        journal_streak=streak,
        koan_sessions_this_week=koan_count,
    )
