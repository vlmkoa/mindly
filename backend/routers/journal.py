"""Journal: today's entry (upsert) + full history."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import JournalEntry, User
from schemas import JournalEntryOut, JournalUpsertIn
from security import current_user

router = APIRouter(prefix="/api/journal", tags=["journal"])


@router.get("/entries", response_model=list[JournalEntryOut])
def list_entries(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """All entries, newest first. The frontend splits 'today' from history."""
    return db.scalars(
        select(JournalEntry)
        .where(JournalEntry.user_id == user.id)
        .order_by(JournalEntry.date.desc())
    ).all()


@router.put("/entries", response_model=JournalEntryOut)
def upsert_entry(body: JournalUpsertIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Create or overwrite the entry for the given date (one per day)."""
    entry = db.scalar(
        select(JournalEntry).where(JournalEntry.user_id == user.id, JournalEntry.date == body.date)
    )
    if entry is None:
        entry = JournalEntry(user_id=user.id, date=body.date)
        db.add(entry)

    # Whole-entry overwrite keeps the semantics simple: the UI always sends
    # the full current state of the editor.
    entry.mode = body.mode
    entry.free_text = body.free_text
    entry.successes = body.successes
    entry.failures = body.failures
    entry.intentions = body.intentions
    db.commit()
    return entry
