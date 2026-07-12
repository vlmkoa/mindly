"""Meditation session logging (audio itself is synthesized in the browser)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import MeditationSession, User
from schemas import MeditationSaveIn
from security import current_user

router = APIRouter(prefix="/api/meditation", tags=["meditation"])


@router.post("/sessions")
def save_session(body: MeditationSaveIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.add(
        MeditationSession(
            user_id=user.id,
            kind=body.kind,
            duration_sec=body.duration_sec,
            sound_config=body.sound_config,
        )
    )
    db.commit()
    return {"ok": True}
