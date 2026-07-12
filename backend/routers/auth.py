"""Auth endpoints: signup, login, logout, me.

All under /api/auth/*. Cookies are HttpOnly; the frontend never sees tokens,
it just calls these endpoints with `credentials: "include"`.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import LoginIn, SignupIn, UserOut
from security import create_session, current_user, destroy_session, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=UserOut)
def signup(body: SignupIn, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=email,
        # Default the display name to the mailbox part, like the old UI did.
        name=body.name.strip() or email.split("@")[0],
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()

    create_session(db, user, response)  # sets the cookie
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    # Same error for "no user" and "bad password" — don't leak which one.
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    create_session(db, user, response)
    return user


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    koan_session: str | None = Cookie(default=None),
):
    destroy_session(db, koan_session, response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    """Who am I? 401 when not logged in — the frontend uses this as its guard."""
    return user
