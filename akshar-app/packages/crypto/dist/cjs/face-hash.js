"use strict";
/**
 * Face Hashing — Perceptual hash (pHash) for face verification.
 *
 * Generates a 64-bit perceptual hash from grayscale face image data.
 * Two captures of the same face produce hashes within FACE_MATCH_THRESHOLD
 * Hamming distance. Different faces produce hashes far apart.
 *
 * Algorithm: 8x8 DCT → median threshold → 64-bit hash.
 * This is intentionally simple for MVP. Production would use a learned embedding.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hammingDistance = exports.computeFaceHash = void 0;
/**
 * Compute a 64-bit perceptual hash from 8x8 grayscale image data.
 *
 * @param pixels - 64 grayscale pixel values (8x8 image, row-major, values 0-255)
 * @returns 16 hex characters (64 bits)
 */
function computeFaceHash(pixels) {
    if (pixels.length !== 64) {
        throw new Error('computeFaceHash: expected 64 pixels (8x8 grayscale image)');
    }
    // Compute simplified DCT (Discrete Cosine Transform) of the 8x8 block
    const dct = computeDCT8x8(pixels);
    // Take the top-left 8x8 coefficients (they ARE the 8x8 — all low-frequency)
    // Compute median of all 64 DCT coefficients (excluding DC component at [0])
    const coefficients = dct.slice(1); // exclude DC (index 0)
    const sorted = [...coefficients].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // Generate 64-bit hash: 1 if coefficient > median, else 0
    let hash = BigInt(0);
    for (let i = 0; i < 64; i++) {
        if (dct[i] > median) {
            hash |= BigInt(1) << BigInt(63 - i);
        }
    }
    // Convert to 16 hex chars (zero-padded)
    return hash.toString(16).padStart(16, '0');
}
exports.computeFaceHash = computeFaceHash;
/**
 * Compute Hamming distance between two hex hashes.
 * Returns the number of differing bits (0 = identical, 64 = maximally different).
 *
 * @param a - First hash (16 hex characters)
 * @param b - Second hash (16 hex characters)
 * @returns Number of differing bits (0-64)
 */
function hammingDistance(a, b) {
    try {
        const va = BigInt('0x' + a);
        const vb = BigInt('0x' + b);
        const xor = va ^ vb;
        return popcount64(xor);
    }
    catch {
        // Invalid hex input — return maximum distance (fail-closed)
        return 64;
    }
}
exports.hammingDistance = hammingDistance;
/**
 * Count the number of set bits in a 64-bit BigInt.
 */
function popcount64(n) {
    let count = 0;
    let val = n < 0n ? -n : n;
    while (val > 0n) {
        count += Number(val & 1n);
        val >>= 1n;
    }
    return count;
}
/**
 * Simplified 8x8 DCT (Type-II Discrete Cosine Transform).
 * Transforms 64 spatial-domain values into 64 frequency-domain coefficients.
 */
function computeDCT8x8(pixels) {
    const N = 8;
    const result = new Array(64);
    for (let u = 0; u < N; u++) {
        for (let v = 0; v < N; v++) {
            let sum = 0;
            for (let x = 0; x < N; x++) {
                for (let y = 0; y < N; y++) {
                    sum +=
                        pixels[x * N + y] *
                            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
                            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
                }
            }
            const cu = u === 0 ? 1 / Math.SQRT2 : 1;
            const cv = v === 0 ? 1 / Math.SQRT2 : 1;
            result[u * N + v] = (cu * cv * sum) / 4;
        }
    }
    return result;
}
//# sourceMappingURL=face-hash.js.map