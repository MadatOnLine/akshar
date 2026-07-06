"""FastAPI application entry point for akshar-ai."""
from __future__ import annotations

import json
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.couch_client import db
from app.routes import classify, trust, drift, moderator
from app.services import style_detector, drift_engine


# --- Structured JSON logging ---
class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        return json.dumps(log_data)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())
logging.getLogger("akshar.ai").addHandler(handler)
logging.getLogger("akshar.ai").setLevel(logging.INFO)
logger = logging.getLogger("akshar.ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect DB, load models. Shutdown: cleanup."""
    await db.connect()
    logger.info("CouchDB connected")

    # Load ML models (non-blocking — graceful degradation if they fail)
    model_loaded = style_detector.load_models()
    if model_loaded:
        drift_engine.load_anchors()
        # Warm up the transformers with one throwaway inference. A cold encode can
        # take several seconds; the mesh aborts slow classify calls, so priming the
        # models here keeps the first real request fast enough to actually land.
        try:
            style_detector.detect_ai_text("warm up the detection pipeline")
            logger.info("Detection models warmed up")
        except Exception as e:
            logger.warning(f"Model warm-up skipped: {e}")
    else:
        logger.warning("StyleDistance model not loaded — AI detection and drift scoring disabled")

    yield
    await db.close()


app = FastAPI(
    title="akshar-ai",
    description="Akshar Protocol AI Detection & Trust Service",
    version="1.0.0",
    lifespan=lifespan,
)

# Routes
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(classify.router)
app.include_router(trust.router)
app.include_router(drift.router)
app.include_router(moderator.router)


@app.get("/ai/health")
async def health():
    """Health check — reports model loading status."""
    return {
        "ok": True,
        "service": "akshar-ai",
        "version": "1.0.0",
        "modelLoaded": style_detector.is_loaded(),
        "pipelineReady": style_detector.pipeline_ready(),
    }
