/**
 * FaceCaptureService — ported directly from research Proof-of-Human-Checker-App.
 *
 * The research implementation (login/static/app.js) works as follows:
 *
 *   1. Start webcam video stream
 *   2. PASSIVE liveness: measure frame-to-frame motion (32x32 grayscale diffs)
 *      over ~1 second. Peak must exceed PASSIVE_MIN (1.0). Proves live feed.
 *   3. ACTIVE challenge: show a random head-movement prompt, measure motion
 *      for 5 seconds. Peak must exceed ACTIVE_MIN (3.5). Proves conscious user.
 *   4. captureHash(): draw current video frame to 8x8 canvas → grayscale →
 *      threshold each pixel against the mean → 64-bit hex hash.
 *
 * No face detection. No cropping. The user self-positions in the camera frame.
 * The hash captures the overall light pattern which is stable per-person.
 *
 * This module uses react-native-camera to get frames and performs the same
 * computation as the research app.js in TypeScript.
 */

import { computeFaceHash, hammingDistance } from '@akshar/crypto';

export { hammingDistance };

// --- Thresholds (from research app.js) ---
const PASSIVE_MIN = 1.0;
const ACTIVE_MIN = 3.5;
const PASSIVE_FRAMES = 8;
const PASSIVE_INTERVAL = 130;
const ACTIVE_TIMEOUT = 5000;
const ACTIVE_INTERVAL = 110;

const CHALLENGES = [
  'Slowly turn your head left, then right',
  'Nod your head up and down',
  'Lean a little closer, then back',
  'Tilt your head side to side',
] as const;

// --- Types ---

export type LivenessStage = 'passive' | 'active' | 'capturing' | 'done';
export type StepStatus = 'pending' | 'ok' | 'fail';

export interface LivenessState {
  stage: LivenessStage;
  passiveStatus: StepStatus;
  activeStatus: StepStatus;
  motionPercent: number;
  challengeText: string;
  timerSeconds: number;
  statusMessage: string;
  statusKind: 'good' | 'bad' | '';
}

export type LivenessCallback = (state: LivenessState) => void;

export interface FaceCaptureResult {
  hash: string;
}

// --- Internal state for a capture session ---

let _cameraReady = false;
let _getFrame32: (() => Float32Array | null) | null = null;
let _getFrame8: (() => number[] | null) | null = null;
let _releaseCamera: (() => void) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function meanAbsDiff(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/**
 * captureHash — exact port of research app.js captureHash().
 *
 * Draws the current video frame to 8x8, converts to grayscale luminance,
 * thresholds against the mean, produces a 16-hex-char (64-bit) hash.
 */
function captureHash(): string | null {
  if (!_cameraReady || !_getFrame8) return null;

  const pixels = _getFrame8();
  if (!pixels || pixels.length !== 64) return null;

  // Use @akshar/crypto computeFaceHash which does:
  // 8x8 DCT → median threshold → 64-bit hash
  return computeFaceHash(pixels);
}

/**
 * Start camera — gets frame providers from the native camera module.
 * Uses react-native-vision-camera which renders a <Camera> component.
 * The frame processor runs on the camera thread and populates shared buffers.
 *
 * NOTE: The camera is rendered by the FaceCamera component in the screen.
 * This function connects to it via the globally-registered frame callbacks.
 */
async function startCamera(): Promise<void> {
  // Camera is already started by the <FaceCamera> component in the screen.
  // We just need to wait a moment for it to initialize and start producing frames.
  await sleep(500);
  _cameraReady = true;

  // Frame providers use react-native-vision-camera's takeSnapshot API
  // via the NativeFaceCapture bridge module.
  const { NativeFaceCapture } = require('react-native').NativeModules;

  if (!NativeFaceCapture) {
    // Fallback: camera component is rendering but native module isn't linked.
    // This happens in development — the camera view shows but frame processing
    // requires the native bridge. Throw a user-friendly error.
    throw new Error(
      'Camera is active but frame processing is not available. ' +
      'Please build the app with the native camera module linked.'
    );
  }

  // 32x32 grayscale frame (for motion detection) —
  // research equivalent: mCtx.drawImage(video, 0, 0, 32, 32) → getImageData → luminance
  _getFrame32 = () => {
    try {
      const rgba = NativeFaceCapture.captureFrameSync(32, 32);
      if (!rgba || rgba.length !== 32 * 32 * 4) return null;
      const g = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
      }
      return g;
    } catch {
      return null;
    }
  };

  // 8x8 grayscale frame (for hash capture) —
  // research equivalent: ctx.drawImage(video, 0, 0, 8, 8) → getImageData → luminance
  _getFrame8 = () => {
    try {
      const rgba = NativeFaceCapture.captureFrameSync(8, 8);
      if (!rgba || rgba.length !== 8 * 8 * 4) return null;
      const lum: number[] = [];
      for (let i = 0; i < 64; i++) {
        lum.push(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
      }
      return lum;
    } catch {
      return null;
    }
  };

  _releaseCamera = () => {
    _cameraReady = false;
    _getFrame32 = null;
    _getFrame8 = null;
  };
}

/**
 * runHybridLiveness — exact port of research app.js runHybridLiveness().
 *
 * Returns the face hash on success, null on failure.
 * Calls onUpdate with UI state for rendering the liveness steps.
 */
export async function runHybridLiveness(onUpdate?: LivenessCallback): Promise<string | null> {
  if (!_cameraReady || !_getFrame32) {
    onUpdate?.({
      stage: 'passive', passiveStatus: 'fail', activeStatus: 'pending',
      motionPercent: 0, challengeText: '', timerSeconds: 0,
      statusMessage: 'Camera is not ready yet.', statusKind: 'bad',
    });
    return null;
  }

  // --- PASSIVE: confirm a live feed (continuous micro-motion) ---
  onUpdate?.({
    stage: 'passive', passiveStatus: 'pending', activeStatus: 'pending',
    motionPercent: 0, challengeText: '', timerSeconds: 0,
    statusMessage: 'Checking passive liveness — hold still for a moment...', statusKind: '',
  });

  let prev: Float32Array | null = null;
  let passivePeak = 0;

  for (let i = 0; i < PASSIVE_FRAMES; i++) {
    const g = _getFrame32();
    if (g && prev) {
      const d = meanAbsDiff(g, prev);
      passivePeak = Math.max(passivePeak, d);
      onUpdate?.({
        stage: 'passive', passiveStatus: 'pending', activeStatus: 'pending',
        motionPercent: Math.min(100, d * 8), challengeText: '', timerSeconds: 0,
        statusMessage: 'Checking passive liveness — hold still for a moment...', statusKind: '',
      });
    }
    if (g) prev = g;
    await sleep(PASSIVE_INTERVAL);
  }

  if (passivePeak < PASSIVE_MIN) {
    onUpdate?.({
      stage: 'passive', passiveStatus: 'fail', activeStatus: 'pending',
      motionPercent: 0, challengeText: '', timerSeconds: 0,
      statusMessage: 'Passive liveness failed — no live motion (a static image?).', statusKind: 'bad',
    });
    return null;
  }

  onUpdate?.({
    stage: 'active', passiveStatus: 'ok', activeStatus: 'pending',
    motionPercent: Math.min(100, passivePeak * 8), challengeText: '', timerSeconds: 5,
    statusMessage: 'Active challenge — follow the on-screen prompt.', statusKind: '',
  });

  // --- ACTIVE: challenge-response (must react to a prompt on cue) ---
  const challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
  prev = null;
  let activePeak = 0;
  const t0 = Date.now();

  while (Date.now() - t0 < ACTIVE_TIMEOUT) {
    const g = _getFrame32();
    if (g && prev) {
      const d = meanAbsDiff(g, prev);
      activePeak = Math.max(activePeak, d);
    }
    if (g) prev = g;

    const elapsed = Date.now() - t0;
    const remaining = Math.ceil((ACTIVE_TIMEOUT - elapsed) / 1000);

    onUpdate?.({
      stage: 'active', passiveStatus: 'ok', activeStatus: 'pending',
      motionPercent: Math.min(100, activePeak * 8),
      challengeText: challenge + ' now', timerSeconds: remaining,
      statusMessage: 'Active challenge — follow the on-screen prompt.', statusKind: '',
    });

    if (activePeak >= ACTIVE_MIN) break;
    await sleep(ACTIVE_INTERVAL);
  }

  if (activePeak < ACTIVE_MIN) {
    onUpdate?.({
      stage: 'active', passiveStatus: 'ok', activeStatus: 'fail',
      motionPercent: 0, challengeText: '', timerSeconds: 0,
      statusMessage: "Active challenge failed — we didn't detect your response. Try again.", statusKind: 'bad',
    });
    return null;
  }

  onUpdate?.({
    stage: 'capturing', passiveStatus: 'ok', activeStatus: 'ok',
    motionPercent: Math.min(100, activePeak * 8), challengeText: '', timerSeconds: 0,
    statusMessage: 'Liveness passed — capturing face...', statusKind: 'good',
  });

  // --- CAPTURE: hash the current frame ---
  const hash = captureHash();
  if (!hash) {
    onUpdate?.({
      stage: 'capturing', passiveStatus: 'ok', activeStatus: 'ok',
      motionPercent: 0, challengeText: '', timerSeconds: 0,
      statusMessage: 'Could not read the camera.', statusKind: 'bad',
    });
    return null;
  }

  onUpdate?.({
    stage: 'done', passiveStatus: 'ok', activeStatus: 'ok',
    motionPercent: 100, challengeText: '', timerSeconds: 0,
    statusMessage: 'Face captured.', statusKind: 'good',
  });

  return hash;
}

/**
 * Full capture flow — starts camera, runs liveness, returns hash.
 * This is the main entry point for screens.
 */
export async function captureFaceWithLiveness(onUpdate?: LivenessCallback): Promise<string> {
  await startCamera();
  try {
    const hash = await runHybridLiveness(onUpdate);
    if (!hash) {
      throw new Error('Liveness check failed. Please try again.');
    }
    return hash;
  } finally {
    _releaseCamera?.();
  }
}

/**
 * Quick capture without liveness — for silent background re-auth.
 * Just grabs a frame and hashes it.
 */
export async function captureHashOnly(): Promise<string> {
  await startCamera();
  try {
    const hash = captureHash();
    if (!hash) throw new Error('Could not capture face');
    return hash;
  } finally {
    _releaseCamera?.();
  }
}
