import { Platform } from 'react-native';
import Constants from 'expo-constants';

if (typeof global !== 'undefined') {
  (global as any).Platform = Platform;
}

export const GlobalPlatform = Platform;

// ─── API URL Resolution ───────────────────────────────────────────────────────
//
// Priority order:
//   1. EXPO_PUBLIC_API_URL  — set in frontend/.env  (required for all builds)
//   2. Web browser fallback — uses current window host
//   3. Replit dev           — derives from REPLIT_DEV_DOMAIN (dev only)
//   4. localhost fallback   — WILL NOT work on physical devices (logs a warning)
//
// To fix "notifications not working" or any API failure on a real device:
//   → Set EXPO_PUBLIC_API_URL=https://your-backend.onrender.com in frontend/.env
// ─────────────────────────────────────────────────────────────────────────────

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

  // 4. ⚠️  UNREACHABLE from any physical device — localhost is NOT the Render server.
  //    Every API call (including push token registration) will fail silently.
  //    → Fix: add EXPO_PUBLIC_API_URL to frontend/.env
  console.error(
    '\n[Config] ❌ EXPO_PUBLIC_API_URL is not set.\n' +
    'The app is using http://localhost:3001 which cannot be reached from a physical device.\n' +
    'Push notifications WILL NOT work until you set EXPO_PUBLIC_API_URL in frontend/.env\n' +
    'Example: EXPO_PUBLIC_API_URL=https://afroconnect-api.onrender.com\n'
  );
  return 'http://localhost:3001';
};

// Log the resolved URL once at startup so it is visible in Metro/device logs
const _resolvedUrl = getApiBaseUrl();
console.log(`[Config] API base URL: ${_resolvedUrl}`);
if (_resolvedUrl.includes('localhost')) {
  console.warn('[Config] ⚠️  Using localhost — push tokens will NOT register on physical devices!');
}

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
