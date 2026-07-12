"""SQLAlchemy engine + per-request session.

`get_db` is a FastAPI dependency: each request gets its own session which is
always closed, and committed only by the route handlers that write.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

import config

# pool_pre_ping avoids "server closed the connection" errors after the DB
# container restarts while the API keeps running.
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all ORM models (see models.py)."""


def get_db():
    """FastAPI dependency — yields a DB session, guarantees close."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
