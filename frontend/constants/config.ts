import { Platform } from 'react-native';
import Constants from 'expo-constants';

if (typeof global !== 'undefined') {
  (global as any).Platform = Platform;
}

export const GlobalPlatform = Platform;


export const getApiBaseUrl = (): string => {
  // 1. Explicit env var — works in dev builds, EAS builds, and production
  if (process.env.EXPO_PUBLIC_API_URL) {
    const url = process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, ''); // strip trailing slash
    return url;
  }

  // 2. Web (browser) — use current host
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '3001') return '';
    return `${protocol}//${hostname}:3001`;
  }

  // 3. Replit dev environment — available when Metro bundles inside Replit
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  // 4. Production fallback — Render backend (used when no .env is present, e.g. Expo Go)
  return 'https://afroconnect-op7e.onrender.com';
};

// Log the resolved URL once at startup so it is visible in Metro/device logs
const _resolvedUrl = getApiBaseUrl();
console.log(`[Config] API base URL: ${_resolvedUrl}`);

export const getSocketUrl = (): string => {
  return getApiBaseUrl();
};

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
