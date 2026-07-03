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
/**
 * Compute a 64-bit perceptual hash from 8x8 grayscale image data.
 *
 * @param pixels - 64 grayscale pixel values (8x8 image, row-major, values 0-255)
 * @returns 16 hex characters (64 bits)
 */
export declare function computeFaceHash(pixels: number[]): string;
/**
 * Compute Hamming distance between two hex hashes.
 * Returns the number of differing bits (0 = identical, 64 = maximally different).
 *
 * @param a - First hash (16 hex characters)
 * @param b - Second hash (16 hex characters)
 * @returns Number of differing bits (0-64)
 */
export declare function hammingDistance(a: string, b: string): number;
//# sourceMappingURL=face-hash.d.ts.map