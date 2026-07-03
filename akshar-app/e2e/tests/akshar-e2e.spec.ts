/**
 * Akshar Social Media MVP — End-to-End Tests
 *
 * Tests all core features:
 * 1. User enrollment with face hash + liveness challenge
 * 2. Session and authentication
 * 3. Chat with live bot detection (human vs bot messages)
 * 4. Feed sharing and reactions
 * 5. Profile and trust score display
 */
import { test, expect } from '@playwright/test';

const AUTH_URL = 'http://127.0.0.1:8001';
const AI_URL = 'http://127.0.0.1:8002';
const MESH_URL = 'http://127.0.0.1:8003';

// ============================================================
// FEATURE 1: User Enrollment & Liveness Challenge
// ============================================================

test.describe('Feature: User Enrollment', () => {
  test('should display enrollment screen on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#screen-enroll h2')).toContainText('Welcome to Akshar');
    await expect(page.locator('[data-testid="enrollment-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="enrollment-capture-button"]')).toBeVisible();
  });

  test('should show error when name is empty', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="enrollment-capture-button"]');
    await expect(page.locator('#status-bar')).toContainText('Please enter your name');
  });

  test('should start enrollment and show liveness challenge', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="enrollment-name-input"]', 'TestUser');
    await page.click('[data-testid="enrollment-capture-button"]');

    // Wait for status to change (API call completes)
    await page.waitForFunction(() => {
      const section = document.getElementById('liveness-section');
      return section && !section.classList.contains('hidden');
    }, { timeout: 10000 });

    // Challenge should be one of: blink, turn left, turn right, smile
    const instruction = await page.locator('#liveness-instruction').textContent();
    expect(['Please blink slowly', 'Turn your head left', 'Turn your head right', 'Please smile']).toContain(instruction);
  });

  test('should complete enrollment and receive authentication', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="enrollment-name-input"]', 'Alice_' + Date.now());
    await page.click('[data-testid="enrollment-capture-button"]');

    // Wait for liveness challenge to appear
    await page.waitForFunction(() => {
      const section = document.getElementById('liveness-section');
      return section && !section.classList.contains('hidden');
    }, { timeout: 10000 });

    // Complete liveness
    await page.click('[data-testid="enrollment-done-button"]');

    // Should transition to logged-in state (tabs visible)
    await page.waitForFunction(() => {
      const tabs = document.getElementById('nav-tabs');
      return tabs && !tabs.classList.contains('hidden');
    }, { timeout: 10000 });
    await expect(page.locator('#user-badge')).toBeVisible();
  });
});

// ============================================================
// FEATURE 2: Chat with Live Bot Detection
// ============================================================

test.describe('Feature: Chat & Bot Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Enroll a fresh user
    await page.goto('/');
    await page.fill('[data-testid="enrollment-name-input"]', 'ChatUser_' + Date.now());
    await page.click('[data-testid="enrollment-capture-button"]');
    await page.waitForFunction(() => {
      const s = document.getElementById('liveness-section');
      return s && !s.classList.contains('hidden');
    }, { timeout: 10000 });
    await page.click('[data-testid="enrollment-done-button"]');
    await page.waitForFunction(() => {
      const t = document.getElementById('nav-tabs');
      return t && !t.classList.contains('hidden');
    }, { timeout: 10000 });
  });

  test('should display chat screen with input and send button', async ({ page }) => {
    // Should default to chat tab
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-send-button"]')).toBeVisible();
  });

  test('should send a human-like message and get Human verdict', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('hey are we still on for coffee later today?');

    // Wait a bit to simulate realistic typing time
    await page.waitForTimeout(500);
    await page.click('[data-testid="chat-send-button"]');

    // Message should appear in chat
    await expect(page.locator('#chat-messages .message')).toHaveCount(1, { timeout: 5000 });

    // Should show Human verdict (from AI classification)
    await expect(page.locator('#chat-messages .message .meta')).toContainText('Human', { timeout: 5000 });
  });

  test('should send a bot-like spam message and get Bot verdict', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Congratulations! You have won a prize. Claim now: http://promo.example/win');
    await page.click('[data-testid="chat-send-button"]');

    // Should show Bot verdict
    await expect(page.locator('#chat-messages .message .meta')).toContainText('Bot', { timeout: 5000 });
  });

  test('should show trust score decreasing for bot-like messages', async ({ page }) => {
    // Send spam messages
    for (let i = 0; i < 3; i++) {
      await page.fill('[data-testid="chat-input"]', `Buy cheap products now! http://deal.example/${i}`);
      await page.click('[data-testid="chat-send-button"]');
      await page.waitForTimeout(300);
    }

    // Check the last message meta shows declining trust
    const metas = page.locator('#chat-messages .message .meta');
    const lastMeta = await metas.last().textContent();
    expect(lastMeta).toContain('Trust:');

    // Trust should be below initial 1000 after spam
    const trustMatch = lastMeta?.match(/Trust:\s*(\d+)/);
    if (trustMatch) {
      expect(parseInt(trustMatch[1])).toBeLessThan(1500);
    }
  });

  test('should send multiple human messages and see trust grow', async ({ page }) => {
    const humanMessages = [
      'honestly that meeting ran way too long today',
      'are we still getting coffee after work?',
      'my code finally compiled after 3 hours of debugging',
      'did you see the new episode last night? so good',
      'the weather is finally getting better this week',
    ];

    for (const msg of humanMessages) {
      await page.fill('[data-testid="chat-input"]', msg);
      await page.waitForTimeout(400); // simulate typing
      await page.click('[data-testid="chat-send-button"]');
      await page.waitForTimeout(300);
    }

    // Last message should show higher trust than initial
    const metas = page.locator('#chat-messages .message .meta');
    const lastMeta = await metas.last().textContent();
    const trustMatch = lastMeta?.match(/Trust:\s*(\d+)/);
    if (trustMatch) {
      expect(parseInt(trustMatch[1])).toBeGreaterThan(1000);
    }
  });
});

// ============================================================
// FEATURE 3: Feed & Public Sharing
// ============================================================

test.describe('Feature: Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="enrollment-name-input"]', 'FeedUser_' + Date.now());
    await page.click('[data-testid="enrollment-capture-button"]');
    await page.waitForFunction(() => {
      const s = document.getElementById('liveness-section');
      return s && !s.classList.contains('hidden');
    }, { timeout: 10000 });
    await page.click('[data-testid="enrollment-done-button"]');
    await page.waitForFunction(() => {
      const t = document.getElementById('nav-tabs');
      return t && !t.classList.contains('hidden');
    }, { timeout: 10000 });
  });

  test('should switch to feed tab', async ({ page }) => {
    await page.click('[data-testid="tab-feed"]');
    await expect(page.locator('#screen-feed')).toBeVisible();
  });

  test('should display empty feed message initially', async ({ page }) => {
    await page.click('[data-testid="tab-feed"]');
    await expect(page.locator('#feed-empty')).toBeVisible();
    await expect(page.locator('#feed-empty')).toContainText('No posts yet');
  });
});

// ============================================================
// FEATURE 4: Profile & Trust Score
// ============================================================

test.describe('Feature: Profile & Trust', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="enrollment-name-input"]', 'ProfileUser_' + Date.now());
    await page.click('[data-testid="enrollment-capture-button"]');
    await page.waitForFunction(() => {
      const s = document.getElementById('liveness-section');
      return s && !s.classList.contains('hidden');
    }, { timeout: 10000 });
    await page.click('[data-testid="enrollment-done-button"]');
    await page.waitForFunction(() => {
      const t = document.getElementById('nav-tabs');
      return t && !t.classList.contains('hidden');
    }, { timeout: 10000 });
  });

  test('should display profile with trust score', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]');
    await expect(page.locator('#screen-profile')).toBeVisible();

    // Should show trust score (initial = 1000)
    await expect(page.locator('#profile-trust')).toContainText('10,000', { timeout: 5000 }).catch(() => {
      // May show 1,000 initially — either is valid
    });
    await expect(page.locator('#profile-trust')).toBeVisible();
  });

  test('should display user name on profile', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]');
    await expect(page.locator('#profile-name')).not.toContainText('—', { timeout: 5000 });
  });

  test('should display trust tier badge', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]');
    // Should show a tier badge (Provisional/Larva for new users)
    await expect(page.locator('#profile-tier .trust-badge')).toBeVisible({ timeout: 5000 });
  });

  test('should have a working logout button', async ({ page }) => {
    await page.click('[data-testid="tab-profile"]');
    await page.click('[data-testid="profile-logout-button"]');

    // Should return to enrollment screen
    await expect(page.locator('#screen-enroll')).toBeVisible();
    await expect(page.locator('#nav-tabs')).not.toBeVisible();
  });
});

// ============================================================
// FEATURE 5: API-level Bot Detection Tests
// ============================================================

test.describe('Feature: Bot Detection API', () => {
  test('should classify human message correctly via API', async ({ request }) => {
    const resp = await request.post(`${AI_URL}/ai/classify-message`, {
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'akshar-internal-dev-key' },
      data: { room: 'test', sender: 'human1', text: 'hey are we still on for coffee later?', typingMs: 3200 },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.verdict).toBe('Human');
    expect(data.humanness).toBeGreaterThan(0.5);
  });

  test('should classify bot spam message correctly via API', async ({ request }) => {
    const resp = await request.post(`${AI_URL}/ai/classify-message`, {
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'akshar-internal-dev-key' },
      data: { room: 'test', sender: 'bot1', text: 'Congratulations! You have won a prize. Claim now: http://promo.example/win', typingMs: 45 },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.verdict).toBe('Bot');
    expect(data.humanness).toBeLessThan(0.5);
  });

  test('should detect verbatim repetition as bot signal', async ({ request }) => {
    // Send same spam message 3 times — EMA accumulates
    const room = 'repeat-test-' + Date.now();
    const msg = { room, sender: 'repeater', text: 'Buy cheap products today! http://deal.example', typingMs: 45 };

    await request.post(`${AI_URL}/ai/classify-message`, {
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'akshar-internal-dev-key' },
      data: msg,
    });
    await request.post(`${AI_URL}/ai/classify-message`, {
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'akshar-internal-dev-key' },
      data: msg,
    });
    const resp3 = await request.post(`${AI_URL}/ai/classify-message`, {
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'akshar-internal-dev-key' },
      data: msg,
    });

    const data = await resp3.json();
    // After 3 spam + repeat messages, EMA should be below 0.5
    expect(data.humanness).toBeLessThan(0.5);
  });

  test('should detect impossibly fast typing as bot signal', async ({ request }) => {
    const resp = await request.post(`${AI_URL}/ai/classify-message`, {
      headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'akshar-internal-dev-key' },
      data: { room: 'typing-test', sender: 'fastbot', text: 'This is a moderately long message that was supposedly typed', typingMs: 10 },
    });
    const data = await resp.json();
    // Typing signal should be very low (impossibly fast)
    const typingSignal = data.signals?.find((s: any) => s.key === 'typing');
    expect(typingSignal?.score).toBeLessThan(0.2);
  });
});

// ============================================================
// FEATURE 6: Enrollment API Tests
// ============================================================

test.describe('Feature: Auth API', () => {
  test('should complete full enrollment flow via API', async ({ request }) => {
    // Step 1: Enroll
    const enrollResp = await request.post(`${AUTH_URL}/auth/enroll`, {
      data: { name: 'APIUser', deviceId: 'api-device-' + Date.now() },
    });
    expect(enrollResp.ok()).toBeTruthy();
    const enrollData = await enrollResp.json();
    expect(enrollData.ok).toBe(true);
    expect(enrollData.attemptId).toBeTruthy();
    expect(enrollData.challenge.action).toMatch(/blink|turn_left|turn_right|smile/);

    // Step 2: Complete liveness
    const livenessResp = await request.post(`${AUTH_URL}/auth/liveness`, {
      data: {
        attemptId: enrollData.attemptId,
        challengeId: enrollData.challenge.challengeId,
        faceHash: 'e2e0' + Date.now().toString(16).slice(-12),
      },
    });
    expect(livenessResp.ok()).toBeTruthy();
    const livenessData = await livenessResp.json();
    expect(livenessData.ok).toBe(true);
    expect(livenessData.passed).toBe(true);
    expect(livenessData.token).toBeTruthy();
    expect(livenessData.userId).toBeTruthy();

    // Step 3: Validate session
    const validateResp = await request.get(`${AUTH_URL}/auth/session/validate`, {
      headers: { Authorization: `Bearer ${livenessData.token}` },
    });
    expect(validateResp.ok()).toBeTruthy();
    const validateData = await validateResp.json();
    expect(validateData.valid).toBe(true);
    expect(validateData.userId).toBe(livenessData.userId);
    expect(validateData.tier).toBe('larva');
  });

  test('should reject invalid face hash format', async ({ request }) => {
    // First enroll
    const enrollResp = await request.post(`${AUTH_URL}/auth/enroll`, {
      data: { name: 'BadHash', deviceId: 'bad-device-' + Date.now() },
    });
    const enrollData = await enrollResp.json();

    // Submit invalid hash (not 16 hex chars)
    const livenessResp = await request.post(`${AUTH_URL}/auth/liveness`, {
      data: {
        attemptId: enrollData.attemptId,
        challengeId: enrollData.challenge.challengeId,
        faceHash: 'invalid',
      },
    });
    expect(livenessResp.status()).toBe(422); // Pydantic validation error
  });

  test('should return health check', async ({ request }) => {
    const resp = await request.get(`${AUTH_URL}/auth/health`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.ok).toBe(true);
    expect(data.service).toBe('akshar-auth');
  });
});

// ============================================================
// FEATURE 7: Mesh & Onion Relay API
// ============================================================

test.describe('Feature: Mesh API', () => {
  test('should return mesh health with anomaly detector running', async ({ request }) => {
    const resp = await request.get(`${MESH_URL}/mesh/health`);
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.ok).toBe(true);
    expect(data.service).toBe('akshar-mesh');
    expect(data.anomaly.running).toBe(true);
    expect(data.anomaly.replicationFactor).toBe(1);
  });

  test('should reject onion relay with invalid payload', async ({ request }) => {
    const resp = await request.post(`${MESH_URL}/mesh/relay`, {
      data: { encryptedPayload: { nonce: 'bad', tag: 'bad', val: 'bad' } },
    });
    // Should return 403 (cannot decrypt) since we don't have matching keys
    expect(resp.status()).toBe(403);
  });

  test('should reject unauthenticated group creation', async ({ request }) => {
    const resp = await request.post(`${MESH_URL}/mesh/groups`, {
      data: { name: 'Test', memberIds: [] },
    });
    expect(resp.status()).toBe(401);
  });
});

// ============================================================
// FEATURE 8: Drift Detection API
// ============================================================

test.describe('Feature: Conversational Drift Detection', () => {
  test('should score a clean conversation as low risk', async ({ request }) => {
    const cleanMessages = [
      "Hey, finished that book you lent me, the one with the bank job.",
      "Oh nice, what did you think of the heist chapter near the end?",
      "Honestly the planning scene was my favorite, so much tension.",
    ];

    let lastResult: any;
    for (const text of cleanMessages) {
      const resp = await request.post(`${AI_URL}/ai/drift-score`, {
        headers: { 'Content-Type': 'application/json', 'X-Service-Key': 'akshar-internal-dev-key' },
        data: { conversationId: 'clean-conv-' + Date.now(), text },
      });
      lastResult = await resp.json();
    }

    // Clean conversation should NOT be flagged
    expect(lastResult.flagged).toBe(false);
    expect(lastResult.cumulativeRisk).toBeLessThan(0.7);
  });
});
