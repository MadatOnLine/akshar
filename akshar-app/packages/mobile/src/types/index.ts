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
  senderTier?: string;
  classification?: {
    verdict: string;
    confidence: number;
    pAI?: number;
  };
  decryptionFailed?: boolean;
  nonce?: string;
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
  sharerName?: string;
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

/* ─── Navigation param lists ─── */

export type RootStackParamList = {
  Home: undefined;
  Chat: { groupId: string; groupName?: string };
};

export type AuthStackParamList = {
  FaceLogin: undefined;
};

export type MainTabParamList = {
  Groups: undefined;
  Feed: undefined;
  Profile: undefined;
  Admin: undefined;
};

export interface DashboardMetrics {
  ok: boolean;
  totalUsers: number;
  usersByTier: {
    larva: number;
    drone: number;
    colony: number;
  };
  flaggedAccounts: {
    userId: string;
    trust: number;
    tier: string;
  }[];
  flaggedConversations: any[];
  botCount: number;
  humanCount: number;
}
