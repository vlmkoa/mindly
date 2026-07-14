"""Environment-driven settings.

Every value has a sane local-dev default so `uvicorn main:app` works outside
Docker too. In docker-compose these are overridden via the `environment:` block.
"""

import os

# Postgres in Docker by default; any SQLAlchemy URL works (incl. sqlite:///)
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://koan:koan@localhost:5432/koan",
)

# Required only for the /api/chat koan endpoint.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Origin of the Next.js frontend, used for CORS when the frontend calls the
# API directly (the default setup proxies through Next rewrites instead, which
# is same-origin and doesn't need CORS — this is a safety net).
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")

# Session cookie parameters. The token itself is an opaque random string
# stored server-side, so no signing secret is needed.
SESSION_COOKIE_NAME = "koan_session"
SESSION_TTL_DAYS = int(os.environ.get("SESSION_TTL_DAYS", "30"))

# Set to "1" when serving over HTTPS so the cookie gets the Secure flag.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"

# ─── Rate limits (see backend/ratelimit.py, LAUNCH_PLAN.md item 1) ────────────
# The chat endpoint spends the owner's Anthropic key, so it is capped per user.
# Pair these with a monthly spend cap in the Anthropic Console as the backstop.
CHAT_RATE_PER_MIN = int(os.environ.get("CHAT_RATE_PER_MIN", "10"))   # burst
CHAT_RATE_PER_DAY = int(os.environ.get("CHAT_RATE_PER_DAY", "100"))  # per-user/day
LOGIN_RATE_PER_MIN = int(os.environ.get("LOGIN_RATE_PER_MIN", "10"))  # per IP
SIGNUP_RATE_PER_MIN = int(os.environ.get("SIGNUP_RATE_PER_MIN", "5"))  # per IP
