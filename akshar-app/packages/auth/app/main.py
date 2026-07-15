"""FastAPI application entry point for akshar-auth."""
from __future__ import annotations

import json
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.couch_client import db
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.logging_middleware import LoggingMiddleware
from app.routes import enrollment, login, session, profile, tier2, studio


# --- Structured JSON logging ---
class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if hasattr(record, "requestId"):
            log_data["requestId"] = record.requestId
        for key in ("method", "path", "status", "duration_ms", "ip", "error"):
            if hasattr(record, key):
                log_data[key] = getattr(record, key)
        return json.dumps(log_data)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())
logging.getLogger("akshar.auth").addHandler(handler)
logging.getLogger("akshar.auth").setLevel(logging.INFO)


# --- Lifespan (startup/shutdown) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    yield
    await db.close()


# --- App creation ---
app = FastAPI(
    title="akshar-auth",
    description="Akshar Protocol Authentication & Identity Service",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware (order matters: outermost first)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(LoggingMiddleware)

# Routes
app.include_router(enrollment.router)
app.include_router(login.router)
app.include_router(session.router)
app.include_router(profile.router)
app.include_router(tier2.router)
app.include_router(studio.router)


@app.get("/auth/health")
async def health():
    """Lightweight health check."""
    return {"ok": True, "service": "akshar-auth", "version": "1.0.0"}
