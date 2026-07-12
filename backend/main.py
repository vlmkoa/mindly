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

import config
from database import Base, engine
from routers import auth, dashboard, journal, koan, meditation, planner, sobriety


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any missing tables at boot (idempotent).
    Base.metadata.create_all(bind=engine)
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
