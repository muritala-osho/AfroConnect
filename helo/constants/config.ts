// API Configuration - Runtime detection for proper platform handling
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Export Platform explicitly and ensure it's on global scope for Metro/React Native
if (typeof global !== 'undefined') {
  (global as any).Platform = Platform;
}

const BACKEND_PORT = 5000;
const GATEWAY_PORT = 5000;

// Export Platform explicitly to ensure it's available if needed elsewhere
export const GlobalPlatform = Platform;

const parseHostname = (uri: string): string | null => {
  if (!uri) return null;
  try {
    const normalizedUri = uri.replace(/^exp:\/\//, 'http://');
    if (normalizedUri.includes('://')) {
      const url = new URL(normalizedUri);
      return url.hostname;
    }
    const colonIdx = uri.indexOf(':');
    return colonIdx > 0 ? uri.substring(0, colonIdx) : uri;
  } catch {
    const cleanUri = uri.replace(/^(exp|http|https):\/\//, '').split('/')[0].split('?')[0];
    const colonIdx = cleanUri.indexOf(':');
    return colonIdx > 0 ? cleanUri.substring(0, colonIdx) : cleanUri;
  }
};

const isLocalAddress = (hostname: string): boolean => {
  if (!hostname) return false;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)
  );
};

export const getApiBaseUrl = (): string => {
  // Try explicit env first
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // In Replit web, we MUST use relative URLs so the gateway (port 5000)
  // correctly handles the proxying to port 3001.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Return empty string to make URLs relative (e.g., /api/auth/signup)
    // The browser will prepend the current origin, and the gateway will catch it.
    return ''; 
  }

  // For native/mobile in Replit, we use the public dev domain
  // Using the domain directly can sometimes lead to 503 if the proxy is sleeping
  // but relative URLs are only for web. 
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || '820de3b8-ca50-4976-b074-3e2ffcbb99ac-00-2e4f6c8p3srvs.picard.replit.dev';
  return `https://${replitDomain}`;
};

export const getSocketUrl = (): string => {
  return getApiBaseUrl();
};

// Log the URLs being used for debugging
console.log('🌐 API Base URL:', getApiBaseUrl());
console.log('📡 Socket URL:', getSocketUrl());

export const API_ENDPOINTS = {
  SIGNUP: '/api/auth/signup',
  LOGIN: '/api/auth/login',
  FORGOT_PASSWORD: '/api/auth/forgot-password',
  RESET_PASSWORD: '/api/auth/reset-password',
  ME: '/api/users/me',
  UPDATE_ME: '/api/users/me',
  NEARBY: '/api/users/nearby',
  USER: (id: string) => `/api/users/${id}`,
  SWIPE: '/api/match/swipe',
  MY_MATCHES: '/api/match/my-matches',
  UNMATCH: (matchId: string) => `/api/match/${matchId}`,
  MESSAGES: (matchId: string) => `/api/chat/${matchId}`,
  SEND_MESSAGE: (matchId: string) => `/api/chat/${matchId}`,
  MARK_SEEN: (messageId: string) => `/api/chat/message/${messageId}/seen`,
  SEND_REQUEST: '/api/friends/request',
  GET_REQUESTS: '/api/friends/requests',
  RESPOND_REQUEST: (requestId: string) => `/api/friends/request/${requestId}`,
  RADAR_NEARBY: '/api/radar/nearby-users',
  RADAR_UPDATE_LOCATION: '/api/radar/location',
  RADAR_TOGGLE_SHARING: '/api/radar/location-sharing',
  RADAR_SETTINGS: '/api/radar/settings',
  INITIATE_CALL: '/api/call/initiate',
  END_CALL: (callId: string) => `/api/call/${callId}/end`,
  CALL_HISTORY: '/api/call/history',
};

export default {
  API_ENDPOINTS,
  getApiBaseUrl,
  getSocketUrl,
};
