export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  bio: string;
  interests: string[];
  photos: string[];
  location: { lat: number; lng: number };
  distance?: number;
  online?: boolean;
  lastActive?: string;
  lookingFor: string;
}

export interface Match {
  id: string;
  user: UserProfile;
  matchedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
  imageUrl?: string;
}

export interface ChatPreview {
  id: string;
  user: UserProfile;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

export interface FriendRequest {
  id: string;
  from: UserProfile;
  status: "pending" | "accepted" | "rejected";
  sentAt: string;
}

export const MOCK_USERS: UserProfile[] = [
  {
    id: "user-2",
    name: "Amara",
    age: 24,
    gender: "Female",
    bio: "Adventure seeker, foodie, and music lover. Looking to connect with genuine people.",
    interests: ["Travel", "Food", "Music", "Photography"],
    photos: [],
    location: { lat: 6.5244, lng: 3.3792 },
    distance: 2.5,
    online: true,
    lookingFor: "Relationship",
  },
  {
    id: "user-3",
    name: "Kwame",
    age: 27,
    gender: "Male",
    bio: "Tech enthusiast and fitness junkie. Love exploring new places and trying new foods.",
    interests: ["Technology", "Fitness", "Travel", "Food"],
    photos: [],
    location: { lat: 6.5344, lng: 3.3892 },
    distance: 4.2,
    online: false,
    lastActive: "2 hours ago",
    lookingFor: "Friendship",
  },
  {
    id: "user-4",
    name: "Zara",
    age: 23,
    gender: "Female",
    bio: "Artist and dancer. Passionate about African culture and contemporary art.",
    interests: ["Art", "Dancing", "Music", "Fashion"],
    photos: [],
    location: { lat: 6.5144, lng: 3.3692 },
    distance: 1.8,
    online: true,
    lookingFor: "Relationship",
  },
  {
    id: "user-5",
    name: "Kofi",
    age: 29,
    gender: "Male",
    bio: "Entrepreneur and book lover. Always up for meaningful conversations.",
    interests: ["Reading", "Technology", "Cooking", "Movies"],
    photos: [],
    location: { lat: 6.5444, lng: 3.3992 },
    distance: 6.1,
    online: false,
    lastActive: "1 day ago",
    lookingFor: "Relationship",
  },
  {
    id: "user-6",
    name: "Nia",
    age: 26,
    gender: "Female",
    bio: "Photographer and traveler. Capturing moments and creating memories.",
    interests: ["Photography", "Travel", "Art", "Music"],
    photos: [],
    location: { lat: 6.5044, lng: 3.3592 },
    distance: 3.7,
    online: true,
    lookingFor: "Casual",
  },
];

export const MOCK_MATCHES: Match[] = [
  {
    id: "match-1",
    user: MOCK_USERS[0],
    matchedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "match-2",
    user: MOCK_USERS[2],
    matchedAt: "2024-01-14T14:20:00Z",
  },
];

export const MOCK_CHATS: ChatPreview[] = [
  {
    id: "chat-1",
    user: MOCK_USERS[0],
    lastMessage: "That sounds amazing! When are you free?",
    timestamp: "10:45 AM",
    unreadCount: 2,
  },
  {
    id: "chat-2",
    user: MOCK_USERS[2],
    lastMessage: "I'd love to! Let's plan something",
    timestamp: "Yesterday",
    unreadCount: 0,
  },
];

export const MOCK_FRIEND_REQUESTS: FriendRequest[] = [
  {
    id: "req-1",
    from: MOCK_USERS[1],
    status: "pending",
    sentAt: "2024-01-16T09:00:00Z",
  },
  {
    id: "req-2",
    from: MOCK_USERS[4],
    status: "pending",
    sentAt: "2024-01-15T16:30:00Z",
  },
];
