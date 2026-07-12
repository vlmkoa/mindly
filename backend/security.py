"""Password hashing + session-cookie authentication.

Flow:
  signup/login  → create AuthSession row → Set-Cookie: koan_session=<token>
  any request   → `current_user` dependency reads the cookie, loads the
                  session + user, 401s if missing/expired.
"""

import secrets
from datetime import timedelta

import bcrypt
from fastapi import Cookie, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from database import get_db
from models import AuthSession, User, utcnow


# ─── Passwords ───────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    # bcrypt truncates at 72 bytes; enforce in schema (max 128 chars is fine,
    # we hash the UTF-8 bytes and bcrypt handles it).
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("ascii"))
    except ValueError:
        # Malformed hash in DB — treat as auth failure, not a 500.
        return False


# ─── Sessions ────────────────────────────────────────────────────────────────

def create_session(db: Session, user: User, response: Response) -> None:
    """Create a session row and attach the cookie to the response."""
    token = secrets.token_urlsafe(32)
    session = AuthSession(
        token=token,
        user_id=user.id,
        expires_at=utcnow() + timedelta(days=config.SESSION_TTL_DAYS),
    )
    db.add(session)
    db.commit()

    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        max_age=config.SESSION_TTL_DAYS * 24 * 3600,
        httponly=True,          # JS cannot read the token
        samesite="lax",         # sent on top-level navigations, blocks CSRF POSTs
        secure=config.COOKIE_SECURE,
        path="/",
    )


def destroy_session(db: Session, token: str | None, response: Response) -> None:
    if token:
        session = db.scalar(select(AuthSession).where(AuthSession.token == token))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(config.SESSION_COOKIE_NAME, path="/")


# ─── Dependency ──────────────────────────────────────────────────────────────

def current_user(
    db: Session = Depends(get_db),
    koan_session: str | None = Cookie(default=None),
) -> User:
    """Resolve the logged-in user or raise 401.

    The cookie parameter name must match config.SESSION_COOKIE_NAME
    ("koan_session") — FastAPI maps the function argument to the cookie key.
    """
    if not koan_session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = db.scalar(select(AuthSession).where(AuthSession.token == koan_session))
    if session is None or session.expires_at < utcnow():
        raise HTTPException(status_code=401, detail="Session expired")

    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user
