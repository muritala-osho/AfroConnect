import { Platform } from 'react-native';
import Constants from 'expo-constants';

if (typeof global !== 'undefined') {
  (global as any).Platform = Platform;
}

export const GlobalPlatform = Platform;


export const getApiBaseUrl = (): string => {
  // Explicit env var — set EXPO_PUBLIC_API_URL in your .env file (or Render/EAS env vars).
  // Example: EXPO_PUBLIC_API_URL=https://your-app.onrender.com
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, ''); // strip trailing slash
  }

  // Replit dev environment — available when Metro bundles inside Replit
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  // No URL configured — throw so the problem is immediately visible in logs
  // rather than failing silently with wrong requests.
  throw new Error(
    '[Config] EXPO_PUBLIC_API_URL is not set. ' +
    'Add it to your .env file: EXPO_PUBLIC_API_URL=https://your-backend-url.onrender.com'
  );
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
