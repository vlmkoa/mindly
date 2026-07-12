# FastAPI backend for the ________ wellness app.
#
# Layout:
#   main.py         - app factory, CORS, router registration, table creation
#   config.py       - env-driven settings (DATABASE_URL, ANTHROPIC_API_KEY, ...)
#   database.py     - SQLAlchemy engine + session dependency
#   models.py       - ORM tables (users, sessions, features)
#   schemas.py      - Pydantic request/response shapes
#   security.py     - password hashing + session-cookie auth dependency
#   prompt.py       - parses lib/system-prompt.ts (single source of truth)
#   routers/        - one file per feature (auth, planner, journal, ...)
