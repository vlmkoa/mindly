"""FastAPI application entry point.

Run locally:   uvicorn main:app --reload --port 8000  (from backend/)
Run in Docker: see ../docker-compose.yml

Tables are created with Base.metadata.create_all on startup — fine for this
project's stage. If the schema starts evolving with data you care about,
switch to Alembic migrations.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

import config
from database import Base, engine
from routers import auth, dashboard, journal, koan, meditation, planner, sobriety


def _migrate(columns: dict[str, str]) -> None:
    """Poor-man's migration: create_all never ALTERs existing tables, so new
    columns on existing installs are added here. Inspector check (not
    IF NOT EXISTS) keeps it dialect-agnostic; the try/except guards the
    multi-worker race. Replace with Alembic if the schema keeps evolving."""
    insp = inspect(engine)
    for table_col, ddl in columns.items():
        table, col = table_col.split(".")
        if col not in {c["name"] for c in insp.get_columns(table)}:
            try:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
            except Exception:
                pass  # another worker added it first


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing tables at boot (idempotent).
    Base.metadata.create_all(bind=engine)
    _migrate({"journal_entries.blocks": "blocks TEXT"})
    yield


app = FastAPI(title="koan wellness API", lifespan=lifespan)

# The default setup proxies /api/* through Next.js (same origin), so CORS is
# not strictly needed — kept for direct-to-:8000 access during debugging.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(planner.router)
app.include_router(sobriety.router)
app.include_router(journal.router)
app.include_router(meditation.router)
app.include_router(koan.router)
app.include_router(dashboard.router)


@app.get("/api/health")
def health():
    """Liveness probe for docker-compose healthcheck."""
    return {"ok": True}
