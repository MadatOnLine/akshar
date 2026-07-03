"""In-memory rate limiter with lockout for brute-force protection."""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from app.config import RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW, RATE_LIMIT_LOCKOUT


@dataclass
class _Entry:
    attempts: int = 0
    window_start: float = 0.0
    locked_until: float = 0.0


class RateLimiter:
    """In-memory sliding-window rate limiter with lockout."""

    def __init__(self) -> None:
        self._entries: dict[str, _Entry] = {}

    def _get(self, key: str) -> _Entry:
        if key not in self._entries:
            self._entries[key] = _Entry()
        return self._entries[key]

    def is_blocked(self, key: str) -> bool:
        """Check if a key is currently rate-limited."""
        entry = self._get(key)
        now = time.time()

        # Check lockout
        if entry.locked_until > now:
            return True

        # If window expired, reset
        if now - entry.window_start > RATE_LIMIT_WINDOW:
            entry.attempts = 0
            entry.window_start = now

        return False

    def record_failure(self, key: str) -> bool:
        """Record a failed attempt. Returns True if now locked out."""
        entry = self._get(key)
        now = time.time()

        # Reset window if expired
        if now - entry.window_start > RATE_LIMIT_WINDOW:
            entry.attempts = 0
            entry.window_start = now

        entry.attempts += 1

        if entry.attempts >= RATE_LIMIT_MAX_ATTEMPTS:
            entry.locked_until = now + RATE_LIMIT_LOCKOUT
            return True

        return False

    def record_success(self, key: str) -> None:
        """Reset the counter on successful auth."""
        if key in self._entries:
            del self._entries[key]

    def remaining_lockout(self, key: str) -> int:
        """Seconds remaining in lockout (0 if not locked)."""
        entry = self._get(key)
        remaining = entry.locked_until - time.time()
        return max(0, int(remaining))

    def cleanup(self) -> None:
        """Remove expired entries to prevent memory leak."""
        now = time.time()
        expired = [
            k for k, e in self._entries.items()
            if e.locked_until < now and now - e.window_start > RATE_LIMIT_WINDOW
        ]
        for k in expired:
            del self._entries[k]


# Global singleton
rate_limiter = RateLimiter()
