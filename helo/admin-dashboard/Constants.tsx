import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  CreditCard, 
  Settings, 
  HelpCircle, 
  Activity,
  UserCheck,
  UserCircle
} from 'lucide-react';
import { User, AdminRole } from './types';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [AdminRole.SUPER_ADMIN, AdminRole.MODERATOR, AdminRole.SUPPORT] },
  { id: 'users', label: 'Citizens', icon: <Users size={20} />, roles: [AdminRole.SUPER_ADMIN, AdminRole.MODERATOR] },
  { id: 'verification', label: 'ID Verification', icon: <UserCheck size={20} />, roles: [AdminRole.SUPER_ADMIN, AdminRole.MODERATOR] },
  { id: 'reports', label: 'Safety Hub', icon: <ShieldAlert size={20} />, roles: [AdminRole.SUPER_ADMIN, AdminRole.MODERATOR] },
  { id: 'payments', label: 'Finances', icon: <CreditCard size={20} />, roles: [AdminRole.SUPER_ADMIN] },
  { id: 'analytics', label: 'Intelligence', icon: <Activity size={20} />, roles: [AdminRole.SUPER_ADMIN] },
  { id: 'profile', label: 'My Profile', icon: <UserCircle size={20} />, roles: [AdminRole.SUPER_ADMIN, AdminRole.MODERATOR, AdminRole.SUPPORT] },
  { id: 'settings', label: 'System Core', icon: <Settings size={20} />, roles: [AdminRole.SUPER_ADMIN] },
];

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Sarah Jenkins',
    email: 'sarah@example.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    photos: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop'
    ],
    age: 24,
    gender: 'female',
    location: 'London, UK',
    status: 'active',
    verificationStatus: 'verified',
    lastActive: '2 mins ago',
    bio: 'Love hiking and photography! Always looking for the next adventure. I spend my weekends exploring hidden city cafes or trekking through the countryside.',
    riskScore: 5,
    reportCount: 0,
    interests: ['Hiking', 'Photography', 'Travel', 'Art', 'Nature'],
    jobTitle: 'Creative Director',
    education: 'UAL: Central Saint Martins',
    lifestyle: {
      smoking: 'Never',
      drinking: 'Socially',
      religion: 'Spiritual'
    }
  },
  {
    id: 'u2',
    name: 'Marcus Chen',
    email: 'marcus@test.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop'
    ],
    age: 29,
    gender: 'male',
    location: 'San Francisco, USA',
    status: 'warned',
    verificationStatus: 'pending',
    lastActive: '1 hour ago',
    bio: 'Tech enthusiast looking for connections. AI researcher by day, Jazz pianist by night. Let\'s talk about the future of neural networks.',
    riskScore: 45,
    reportCount: 3,
    interests: ['AI', 'Jazz', 'Coffee', 'Coding', 'Chess'],
    jobTitle: 'ML Engineer',
    education: 'Stanford University',
    lifestyle: {
      smoking: 'Never',
      drinking: 'Often',
      religion: 'Atheist'
    }
  },
  {
    id: 'u3',
    name: 'Alex Rivera',
    email: 'alex@dev.com',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop',
    photos: [
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=600&h=800&fit=crop'
    ],
    age: 31,
    gender: 'non-binary',
    location: 'Madrid, Spain',
    status: 'active',
    verificationStatus: 'verified',
    lastActive: '10 mins ago',
    bio: 'Art lover and world traveler. Life is too short for bad coffee. I believe in meaningful conversations and authentic connections.',
    riskScore: 12,
    reportCount: 1,
    interests: ['Design', 'Cuisine', 'Museums', 'Literature'],
    jobTitle: 'Independent Curator',
    education: 'Complutense University',
    lifestyle: {
      smoking: 'Socially',
      drinking: 'Socially',
      religion: 'Catholic'
    }
  }
];

export const MOCK_VERIFICATIONS = [
  {
    id: 'v1',
    userId: 'u2',
    userName: 'Marcus Chen',
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    idPhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
    timestamp: '1 hour ago'
  },
  {
    id: 'v2',
    userId: 'u4',
    userName: 'Jessica Wu',
    profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    idPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    timestamp: '3 hours ago'
  }
];

export const ANALYTICS_DATA = [
  { name: 'Mon', active: 4500, matches: 1200, messages: 8000 },
  { name: 'Tue', active: 5200, matches: 1500, messages: 9500 },
  { name: 'Wed', active: 4800, matches: 1100, messages: 7800 },
  { name: 'Thu', active: 6100, matches: 1900, messages: 12000 },
  { name: 'Fri', active: 7500, matches: 2500, messages: 15000 },
  { name: 'Sat', active: 8200, matches: 3100, messages: 18000 },
  { name: 'Sun', active: 7900, matches: 2800, messages: 16500 },
];

export const REVENUE_DATA = [
  { date: '2023-10-01', basic: 4000, gold: 2400, platinum: 1800 },
  { date: '2023-10-02', basic: 3000, gold: 1398, platinum: 2210 },
  { date: '2023-10-03', basic: 2000, gold: 9800, platinum: 2290 },
  { date: '2023-10-04', basic: 2780, gold: 3908, platinum: 2000 },
  { date: '2023-10-05', basic: 1890, gold: 4800, platinum: 2181 },
  { date: '2023-10-06', basic: 2390, gold: 3800, platinum: 2500 },
  { date: '2023-10-07', basic: 3490, gold: 4300, platinum: 2100 },
];
