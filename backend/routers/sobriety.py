"""Sobriety tracking: addictions with live timers and relapse history."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import Addiction, RelapseEvent, User, utcnow
from schemas import AddictionCreateIn, AddictionOut
from security import current_user

router = APIRouter(prefix="/api/sobriety", tags=["sobriety"])


@router.get("/addictions", response_model=list[AddictionOut])
def list_addictions(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(
        select(Addiction)
        .where(Addiction.user_id == user.id, Addiction.active.is_(True))
        .order_by(Addiction.created_at)
    ).all()


@router.post("/addictions", response_model=AddictionOut)
def start_tracking(body: AddictionCreateIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    addiction = Addiction(user_id=user.id, type=body.type, label=body.label.strip())
    db.add(addiction)
    db.commit()
    return addiction


def _owned_addiction(db: Session, user: User, addiction_id: str) -> Addiction:
    addiction = db.get(Addiction, addiction_id)
    if addiction is None or addiction.user_id != user.id or not addiction.active:
        raise HTTPException(status_code=404, detail="Addiction not found")
    return addiction


@router.post("/addictions/{addiction_id}/relapse", response_model=AddictionOut)
def record_relapse(addiction_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Record a reset: archive the ended streak, restart the clock."""
    addiction = _owned_addiction(db, user, addiction_id)
    now = utcnow()
    db.add(RelapseEvent(addiction_id=addiction.id, occurred_at=now, previous_start=addiction.sobriety_start))
    addiction.sobriety_start = now
    db.commit()
    db.refresh(addiction)  # reload with the new relapse in .relapses
    return addiction


@router.post("/addictions/{addiction_id}/stop")
def stop_tracking(addiction_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Soft-delete: keep the rows (history) but hide from the UI."""
    addiction = _owned_addiction(db, user, addiction_id)
    addiction.active = False
    db.commit()
    return {"ok": True}
