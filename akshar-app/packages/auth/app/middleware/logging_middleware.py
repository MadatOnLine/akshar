"""Structured request logging middleware (SECURITY-03 compliance)."""
from __future__ import annotations

import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("akshar.auth")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Logs every request with structured data. No PII in output."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.time()

        response = await call_next(request)

        duration_ms = round((time.time() - start) * 1000, 1)
        logger.info(
            "request",
            extra={
                "requestId": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "ip": request.client.host if request.client else "unknown",
            },
        )

        response.headers["X-Request-Id"] = request_id
        return response
