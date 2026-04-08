import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import socketService from '@/services/socket';

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
