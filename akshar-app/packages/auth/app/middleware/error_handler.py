"""Global exception handler — fail-closed, generic error responses."""
from __future__ import annotations

import logging
import traceback

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("akshar.auth")


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Catches all unhandled exceptions and returns generic 500 responses."""

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            # Log full traceback internally
            logger.error(
                "Unhandled exception",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                },
            )
            # Return generic error (SECURITY-09: no stack traces to client)
            return JSONResponse(
                status_code=500,
                content={"ok": False, "error": "Internal server error"},
            )
