/**
 * Shared type definitions for akshar-mobile.
 */

export interface EncryptedBlob {
  nonce: string;
  tag: string;
  val: string;
}

export interface DecryptedMessage {
  msgId: string;
  from: string;
  fromId: string;
  text: string;
  ts: number;
  classification?: {
    verdict: string;
    confidence: number;
    pAI?: number;
  };
}

export interface Group {
  groupId: string;
  name: string;
  adminId: string;
  memberIds: string[];
  sealed: boolean;
  createdAt: string;
}

export interface FeedPost {
  postId: string;
  sharerId: string;
  originalAuthorId: string;
  sourceGroupId: string;
  content: string;
  likes: number;
  dislikes: number;
  shares: number;
  ts: number;
}

export interface UserProfile {
  userId: string;
  name: string;
  tier: string;
  trustScore: number;
  createdAt: string;
  status: string;
}

export interface TrustState {
  userId: string;
  trust: number;
  tier: string;
  evidence: number;
  history: number[];
}

export interface LivenessChallenge {
  attemptId: string;
  challengeId: string;
  action: 'blink' | 'turn_left' | 'turn_right' | 'smile';
  timeout: number;
}

export type TrustTier = 'Low Trust / Suspect' | 'Provisional' | 'Likely Human' | 'Trusted Human';
