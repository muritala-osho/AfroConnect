import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '@/services/socket';
import { getApiBaseUrl } from '@/constants/config';

interface UnreadContextType {
  unreadCount: number;
  resetUnread: () => void;
  incrementUnread: () => void;
}

const UnreadContext = createContext<UnreadContextType>({
  unreadCount: 0,
  resetUnread: () => {},
  incrementUnread: () => {},
});

/** Safely update the OS-level app icon badge (iOS + some Android launchers). */
function syncOsBadge(count: number) {
  if (Platform.OS === 'web') return;
  Notifications.setBadgeCountAsync(count).catch(() => {});
}

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  // Track whether the user is currently inside any chat screen.
  const chatOpenRef = useRef(false);

  const incrementUnread = useCallback(() => {
    if (!chatOpenRef.current) {
      setUnreadCount(prev => {
        const next = prev + 1;
        syncOsBadge(next);
        return next;
      });
    }
  }, []);

  const resetUnread = useCallback(() => {
    setUnreadCount(0);
    syncOsBadge(0);
  }, []);

  // Register a method so ChatDetailScreen can signal it is open/closed
  (UnreadContext as any)._setChatOpen = (open: boolean) => {
    chatOpenRef.current = open;
    if (open) {
      setUnreadCount(0);
      syncOsBadge(0);
    }
  };

  // Fetch the real unread count from the server on mount so the badge
  // reflects actual DB state rather than starting from 0 every launch.
  useEffect(() => {
    let cancelled = false;

    const fetchInitialUnread = async () => {
      try {
        const authToken = await AsyncStorage.getItem('auth_token');
        if (!authToken) return;

        const res = await fetch(`${getApiBaseUrl()}/api/chat/unread-count`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (data.success && typeof data.count === 'number' && !cancelled) {
          setUnreadCount(data.count);
          syncOsBadge(data.count);
        }
      } catch {
        // Network failure on startup — badge stays at 0, increments on next message
      }
    };

    fetchInitialUnread();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleNewMessage = (_message: any) => {
      incrementUnread();
    };

    socketService.onNewMessage(handleNewMessage);

    return () => {
      socketService.off('chat:new-message', handleNewMessage);
    };
  }, [incrementUnread]);

  return (
    <UnreadContext.Provider value={{ unreadCount, resetUnread, incrementUnread }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}

// Called by ChatDetailScreen to suppress badge counting while user is in a chat
export function setChatScreenOpen(open: boolean) {
  const fn = (UnreadContext as any)._setChatOpen;
  if (typeof fn === 'function') fn(open);
}
