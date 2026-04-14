export enum AdminRole {
  SUPER_ADMIN = 'Super Admin',
  MODERATOR = 'Moderator',
  SUPPORT = 'Support'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  photos: string[];
  age: number;
  gender: 'male' | 'female' | 'non-binary';
  location: string;
  status: 'active' | 'suspended' | 'banned' | 'warned';
  verificationStatus: 'verified' | 'unverified' | 'pending';
  lastActive: string;
  bio: string;
  riskScore: number;
  reportCount: number;
  interests: string[];
  jobTitle?: string;
  education?: string;
  lifestyle?: {
    smoking: string;
    drinking: string;
    religion: string;
  };
}

export interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  reason: 'harassment' | 'scam' | 'nudity' | 'fake' | 'other';
  status: 'pending' | 'resolved' | 'dismissed';
  timestamp: string;
  description: string;
}

export interface SubscriptionData {
  plan: 'free' | 'premium';
  revenue: number;
  date: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: {
    name: string;
    role: AdminRole;
    email: string;
    avatar?: string;
  } | null;
}

export type BroadcastTarget =
  | 'all'
  | 'male'
  | 'female'
  | 'verified'
  | 'premium';

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  target: BroadcastTarget;
  status: 'sent' | 'draft' | 'scheduled';
  timestamp: string;
  reach: number;
  openRate: string;
}

export interface PushTemplate {
  id: string;
  name: string;
  category: string;
  title: string;
  body: string;
}

// ─── Support System Types ──────────────────────────────────────────────────

export interface TicketMessage {
  _id?: string;
  role: 'user' | 'admin' | 'agent';
  content: string;
  senderName?: string;
  adminName?: string; // legacy compat
  senderId?: string;
  timestamp: string;
}

export interface SupportTicket {
  _id: string;
  id?: string; // legacy alias
  userId?: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: 'billing' | 'account' | 'technical' | 'safety' | 'other';
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'pending' | 'in-progress' | 'closed';
  messages: TicketMessage[];
  assignedTo?: { _id: string; name: string; email: string } | null;
  unreadByUser?: number;
  unreadByAgent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupportAgent {
  _id: string;
  name: string;
  email: string;
  isSupportAgent: boolean;
  isAdmin: boolean;
}

export interface FlaggedContent {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'profile_photo' | 'story' | 'message_image';
  imageUrl: string;
  reason: string;
  flaggedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  aiConfidence?: number;
}
