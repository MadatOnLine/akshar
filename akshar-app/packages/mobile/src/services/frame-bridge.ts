/**
 * Shared frame buffers between FaceCamera (producer) and face-capture (consumer).
 */
let _latestFrame32: Float32Array | null = null;
let _latestFrame8: number[] | null = null;
let _frameReady = false;

export function setLatestFrames(frame32: Float32Array | null, frame8: number[] | null): void {
  _latestFrame32 = frame32;
  _latestFrame8 = frame8;
  _frameReady = frame32 !== null && frame8 !== null;
}

export function getLatestFrame32(): Float32Array | null {
  return _latestFrame32;
}

export function getLatestFrame8(): number[] | null {
  return _latestFrame8;
}

export function isFrameBridgeReady(): boolean {
  return _frameReady;
}

export function resetFrameBridge(): void {
  _latestFrame32 = null;
  _latestFrame8 = null;
  _frameReady = false;
}
