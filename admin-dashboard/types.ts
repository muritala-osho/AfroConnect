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
  plan: 'basic' | 'gold' | 'platinum';
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
  | 'platinum'
  | 'gold'
  | 'lagos'
  | 'london';

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

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  category: 'billing' | 'account' | 'technical' | 'report' | 'other';
  status: 'open' | 'in-progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  message: string;
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
