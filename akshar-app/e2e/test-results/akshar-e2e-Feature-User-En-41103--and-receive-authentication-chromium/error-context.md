# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: akshar-e2e.spec.ts >> Feature: User Enrollment >> should complete enrollment and receive authentication
- Location: tests/akshar-e2e.spec.ts:51:7

# Error details

```
Error: page.waitForFunction: Target page, context or browser has been closed
```

# Test source

```ts
  1   | /**
  2   |  * Akshar Social Media MVP — End-to-End Tests
  3   |  *
  4   |  * Tests all core features:
  5   |  * 1. User enrollment with face hash + liveness challenge
  6   |  * 2. Session and authentication
  7   |  * 3. Chat with live bot detection (human vs bot messages)
  8   |  * 4. Feed sharing and reactions
  9   |  * 5. Profile and trust score display
  10  |  */
  11  | import { test, expect } from '@playwright/test';
  12  | 
  13  | const AUTH_URL = 'http://127.0.0.1:8001';
  14  | const AI_URL = 'http://127.0.0.1:8002';
  15  | const MESH_URL = 'http://127.0.0.1:8003';
  16  | 
  17  | // ============================================================
  18  | // FEATURE 1: User Enrollment & Liveness Challenge
  19  | // ============================================================
  20  | 
  21  | test.describe('Feature: User Enrollment', () => {
  22  |   test('should display enrollment screen on first visit', async ({ page }) => {
  23  |     await page.goto('/');
  24  |     await expect(page.locator('#screen-enroll h2')).toContainText('Welcome to Akshar');
  25  |     await expect(page.locator('[data-testid="enrollment-name-input"]')).toBeVisible();
  26  |     await expect(page.locator('[data-testid="enrollment-capture-button"]')).toBeVisible();
  27  |   });
  28  | 
  29  |   test('should show error when name is empty', async ({ page }) => {
  30  |     await page.goto('/');
  31  |     await page.click('[data-testid="enrollment-capture-button"]');
  32  |     await expect(page.locator('#status-bar')).toContainText('Please enter your name');
  33  |   });
  34  | 
  35  |   test('should start enrollment and show liveness challenge', async ({ page }) => {
  36  |     await page.goto('/');
  37  |     await page.fill('[data-testid="enrollment-name-input"]', 'TestUser');
  38  |     await page.click('[data-testid="enrollment-capture-button"]');
  39  | 
  40  |     // Wait for status to change (API call completes)
  41  |     await page.waitForFunction(() => {
  42  |       const section = document.getElementById('liveness-section');
  43  |       return section && !section.classList.contains('hidden');
  44  |     }, { timeout: 10000 });
  45  | 
  46  |     // Challenge should be one of: blink, turn left, turn right, smile
  47  |     const instruction = await page.locator('#liveness-instruction').textContent();
  48  |     expect(['Please blink slowly', 'Turn your head left', 'Turn your head right', 'Please smile']).toContain(instruction);
  49  |   });
  50  | 
  51  |   test('should complete enrollment and receive authentication', async ({ page }) => {
  52  |     await page.goto('/');
  53  |     await page.fill('[data-testid="enrollment-name-input"]', 'Alice_' + Date.now());
  54  |     await page.click('[data-testid="enrollment-capture-button"]');
  55  | 
  56  |     // Wait for liveness challenge to appear
> 57  |     await page.waitForFunction(() => {
      |                ^ Error: page.waitForFunction: Target page, context or browser has been closed
  58  |       const section = document.getElementById('liveness-section');
  59  |       return section && !section.classList.contains('hidden');
  60  |     }, { timeout: 10000 });
  61  | 
  62  |     // Complete liveness
  63  |     await page.click('[data-testid="enrollment-done-button"]');
  64  | 
  65  |     // Should transition to logged-in state (tabs visible)
  66  |     await page.waitForFunction(() => {
  67  |       const tabs = document.getElementById('nav-tabs');
  68  |       return tabs && !tabs.classList.contains('hidden');
  69  |     }, { timeout: 10000 });
  70  |     await expect(page.locator('#user-badge')).toBeVisible();
  71  |   });
  72  | });
  73  | 
  74  | // ============================================================
  75  | // FEATURE 2: Chat with Live Bot Detection
  76  | // ============================================================
  77  | 
  78  | test.describe('Feature: Chat & Bot Detection', () => {
  79  |   test.beforeEach(async ({ page }) => {
  80  |     // Enroll a fresh user
  81  |     await page.goto('/');
  82  |     await page.fill('[data-testid="enrollment-name-input"]', 'ChatUser_' + Date.now());
  83  |     await page.click('[data-testid="enrollment-capture-button"]');
  84  |     await page.waitForFunction(() => {
  85  |       const s = document.getElementById('liveness-section');
  86  |       return s && !s.classList.contains('hidden');
  87  |     }, { timeout: 10000 });
  88  |     await page.click('[data-testid="enrollment-done-button"]');
  89  |     await page.waitForFunction(() => {
  90  |       const t = document.getElementById('nav-tabs');
  91  |       return t && !t.classList.contains('hidden');
  92  |     }, { timeout: 10000 });
  93  |   });
  94  | 
  95  |   test('should display chat screen with input and send button', async ({ page }) => {
  96  |     // Should default to chat tab
  97  |     await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
  98  |     await expect(page.locator('[data-testid="chat-send-button"]')).toBeVisible();
  99  |   });
  100 | 
  101 |   test('should send a human-like message and get Human verdict', async ({ page }) => {
  102 |     const input = page.locator('[data-testid="chat-input"]');
  103 |     await input.fill('hey are we still on for coffee later today?');
  104 | 
  105 |     // Wait a bit to simulate realistic typing time
  106 |     await page.waitForTimeout(500);
  107 |     await page.click('[data-testid="chat-send-button"]');
  108 | 
  109 |     // Message should appear in chat
  110 |     await expect(page.locator('#chat-messages .message')).toHaveCount(1, { timeout: 5000 });
  111 | 
  112 |     // Should show Human verdict (from AI classification)
  113 |     await expect(page.locator('#chat-messages .message .meta')).toContainText('Human', { timeout: 5000 });
  114 |   });
  115 | 
  116 |   test('should send a bot-like spam message and get Bot verdict', async ({ page }) => {
  117 |     const input = page.locator('[data-testid="chat-input"]');
  118 |     await input.fill('Congratulations! You have won a prize. Claim now: http://promo.example/win');
  119 |     await page.click('[data-testid="chat-send-button"]');
  120 | 
  121 |     // Should show Bot verdict
  122 |     await expect(page.locator('#chat-messages .message .meta')).toContainText('Bot', { timeout: 5000 });
  123 |   });
  124 | 
  125 |   test('should show trust score decreasing for bot-like messages', async ({ page }) => {
  126 |     // Send spam messages
  127 |     for (let i = 0; i < 3; i++) {
  128 |       await page.fill('[data-testid="chat-input"]', `Buy cheap products now! http://deal.example/${i}`);
  129 |       await page.click('[data-testid="chat-send-button"]');
  130 |       await page.waitForTimeout(300);
  131 |     }
  132 | 
  133 |     // Check the last message meta shows declining trust
  134 |     const metas = page.locator('#chat-messages .message .meta');
  135 |     const lastMeta = await metas.last().textContent();
  136 |     expect(lastMeta).toContain('Trust:');
  137 | 
  138 |     // Trust should be below initial 1000 after spam
  139 |     const trustMatch = lastMeta?.match(/Trust:\s*(\d+)/);
  140 |     if (trustMatch) {
  141 |       expect(parseInt(trustMatch[1])).toBeLessThan(1500);
  142 |     }
  143 |   });
  144 | 
  145 |   test('should send multiple human messages and see trust grow', async ({ page }) => {
  146 |     const humanMessages = [
  147 |       'honestly that meeting ran way too long today',
  148 |       'are we still getting coffee after work?',
  149 |       'my code finally compiled after 3 hours of debugging',
  150 |       'did you see the new episode last night? so good',
  151 |       'the weather is finally getting better this week',
  152 |     ];
  153 | 
  154 |     for (const msg of humanMessages) {
  155 |       await page.fill('[data-testid="chat-input"]', msg);
  156 |       await page.waitForTimeout(400); // simulate typing
  157 |       await page.click('[data-testid="chat-send-button"]');
```