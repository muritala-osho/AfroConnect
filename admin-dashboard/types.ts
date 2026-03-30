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
