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

export interface Tier2Check {
  id: string;
  label: string;
  score: number;
  detail: string;
  pass: boolean;
}

export interface Tier2State {
  status: string;
  verdict: string;
  humanness: number;
  lastFaceMatchDistance?: number | null;
  checks: Tier2Check[];
  requiresRiskCheck?: boolean;
  riskReason?: string;
}

export interface StudioTrust {
  score: number;
  tier: string;
  integrity: { status: string; verdict: string; humanness: number; checks: Tier2Check[] };
  binding: { status: string; verdict: string; humanness: number; checks: Tier2Check[] };
}

export interface StudioAnalytics {
  totals: { posts: number; likes: number; dislikes: number; shares: number; netSentiment: number };
  posts: Array<{
    postId: string;
    content: string;
    likes: number;
    dislikes: number;
    shares: number;
    engagement: number;
  }>;
}

export interface ReportAppeal {
  status: string;
  text: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface AccountReport {
  reportId: string;
  category: string;
  reason: string;
  status: string;
  createdAt?: string;
  appeal: ReportAppeal;
}

export interface StudioDashboard {
  ok: boolean;
  userId: string;
  requiresRiskCheck: boolean;
  riskReason: string;
  trust: StudioTrust;
  analytics: StudioAnalytics;
  reports: AccountReport[];
}

export interface RiskStatus {
  requiresRiskCheck: boolean;
  riskReason: string;
  trustScore?: number;
  qualifyingReports?: number;
}

/* ─── Navigation param lists ─── */

export type RootStackParamList = {
  Home: undefined;
  Chat: { groupId: string; groupName: string };
  AccountStudio: undefined;
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
    riskHold?: boolean;
    riskReason?: string;
  }[];
  flaggedConversations: any[];
  botCount: number;
  humanCount: number;
}
