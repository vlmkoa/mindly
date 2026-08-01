"""Auth endpoints: signup, login, logout, me.

All under /api/auth/*. Cookies are HttpOnly; the frontend never sees tokens,
it just calls these endpoints with `credentials: "include"`.
"""

import hashlib
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, Cookie
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import config
import mailer
from database import get_db
from models import AuthSession, EmailToken, User, utcnow
from ratelimit import enforce_ip_limit
from schemas import ForgotIn, LoginIn, ResetIn, SignupIn, UserOut, VerifyIn
from security import create_session, current_user, destroy_session, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Emailed single-use tokens (reset + verify) ──────────────────────────────

def _issue_token(db: Session, user_id: str, kind: str, ttl: timedelta) -> str:
    """Store the hash, return the raw token (it goes into the emailed link)."""
    raw = secrets.token_urlsafe(32)
    db.add(EmailToken(
        user_id=user_id,
        kind=kind,
        token_hash=hashlib.sha256(raw.encode()).hexdigest(),
        expires_at=utcnow() + ttl,
    ))
    db.commit()
    return raw


def _consume_token(db: Session, raw: str, kind: str) -> User | None:
    """Validate + burn a token; returns its user, or None. Caller commits."""
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    tok = db.scalar(select(EmailToken).where(
        EmailToken.token_hash == token_hash, EmailToken.kind == kind))
    if tok is None or tok.used_at is not None or tok.expires_at < utcnow():
        return None
    tok.used_at = utcnow()
    return db.get(User, tok.user_id)


@router.post("/signup", response_model=UserOut)
def signup(body: SignupIn, request: Request, response: Response, db: Session = Depends(get_db)):
    # Cap sign-ups per IP so nobody farms accounts to bypass the per-user chat
    # quota (invite-gating in LAUNCH_PLAN item 9 is the real fix).
    enforce_ip_limit(db, request, "signup", config.SIGNUP_RATE_PER_MIN,
                     "Too many sign-ups from this network. Wait a minute and try again.")
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

    # Chat is gated on a verified mailbox (it spends real money) — send the
    # link now; everything else works immediately.
    raw = _issue_token(db, user.id, "verify", timedelta(hours=config.VERIFY_TOKEN_TTL_HOURS))
    mailer.send_verify_link(user.email, raw)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    # Throttle brute-force before touching bcrypt.
    enforce_ip_limit(db, request, "login", config.LOGIN_RATE_PER_MIN,
                     "Too many attempts. Wait a minute and try again.")
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


@router.post("/forgot")
def forgot(body: ForgotIn, request: Request, db: Session = Depends(get_db)):
    enforce_ip_limit(db, request, "forgot", config.FORGOT_RATE_PER_MIN,
                     "Too many reset requests. Wait a minute and try again.")
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if user:
        raw = _issue_token(db, user.id, "reset",
                           timedelta(minutes=config.RESET_TOKEN_TTL_MIN))
        mailer.send_reset_link(user.email, raw)
    # Identical response whether the address exists or not — no enumeration.
    return {"ok": True}


@router.post("/reset")
def reset(body: ResetIn, request: Request, db: Session = Depends(get_db)):
    enforce_ip_limit(db, request, "reset", config.LOGIN_RATE_PER_MIN,
                     "Too many attempts. Wait a minute and try again.")
    user = _consume_token(db, body.token, "reset")
    if user is None:
        raise HTTPException(status_code=400,
                            detail="This reset link is invalid or has expired.")
    user.password_hash = hash_password(body.password)
    # Completing a reset proves mailbox control — counts as verification.
    user.email_verified = True
    # Revoke every session: whoever held the old password is logged out.
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.commit()
    return {"ok": True}


@router.post("/verify")
def verify(body: VerifyIn, db: Session = Depends(get_db)):
    user = _consume_token(db, body.token, "verify")
    if user is None:
        raise HTTPException(status_code=400,
                            detail="This verification link is invalid or has expired.")
    user.email_verified = True
    db.commit()
    return {"ok": True}


@router.post("/resend-verification")
def resend_verification(request: Request, db: Session = Depends(get_db),
                        user: User = Depends(current_user)):
    enforce_ip_limit(db, request, "verify_resend", config.FORGOT_RATE_PER_MIN,
                     "Too many requests. Wait a minute and try again.")
    if not user.email_verified:
        raw = _issue_token(db, user.id, "verify",
                           timedelta(hours=config.VERIFY_TOKEN_TTL_HOURS))
        mailer.send_verify_link(user.email, raw)
    return {"ok": True}
