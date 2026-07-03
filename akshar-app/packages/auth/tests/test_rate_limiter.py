"""Tests for the rate limiter service."""
from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from app.services.rate_limiter import RateLimiter


@pytest.fixture
def limiter():
    return RateLimiter()


def test_not_blocked_initially(limiter):
    assert limiter.is_blocked("ip:1.2.3.4") is False


def test_blocked_after_max_attempts(limiter):
    key = "ip:test"
    for _ in range(5):
        limiter.record_failure(key)
    assert limiter.is_blocked(key) is True


def test_not_blocked_below_max(limiter):
    key = "ip:test"
    for _ in range(4):
        limiter.record_failure(key)
    assert limiter.is_blocked(key) is False


def test_success_resets_counter(limiter):
    key = "ip:test"
    for _ in range(4):
        limiter.record_failure(key)
    limiter.record_success(key)
    assert limiter.is_blocked(key) is False
    # Should be able to fail 4 more times now
    for _ in range(4):
        limiter.record_failure(key)
    assert limiter.is_blocked(key) is False


def test_lockout_expires(limiter):
    key = "ip:test"
    for _ in range(5):
        limiter.record_failure(key)
    assert limiter.is_blocked(key) is True

    # Simulate time passing beyond lockout
    limiter._entries[key].locked_until = time.time() - 1
    assert limiter.is_blocked(key) is False


def test_remaining_lockout(limiter):
    key = "ip:test"
    for _ in range(5):
        limiter.record_failure(key)
    remaining = limiter.remaining_lockout(key)
    assert remaining > 0
    assert remaining <= 300


def test_cleanup_removes_expired(limiter):
    key = "ip:old"
    limiter.record_failure(key)
    # Simulate old window
    limiter._entries[key].window_start = time.time() - 120
    limiter._entries[key].locked_until = time.time() - 1
    limiter.cleanup()
    assert key not in limiter._entries


def test_window_reset_after_expiry(limiter):
    key = "ip:test"
    for _ in range(4):
        limiter.record_failure(key)
    # Simulate window expiry
    limiter._entries[key].window_start = time.time() - 120
    # After window expires, should reset
    assert limiter.is_blocked(key) is False
    # And counter should be at 0 again
    for _ in range(4):
        limiter.record_failure(key)
    assert limiter.is_blocked(key) is False
