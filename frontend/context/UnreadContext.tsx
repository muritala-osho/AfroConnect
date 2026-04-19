import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
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

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  // Track whether the user is currently inside any chat screen.
  // ChatDetailScreen sets this flag on mount/unmount via the context methods.
  const chatOpenRef = useRef(false);

  const incrementUnread = useCallback(() => {
    // Only count when the user is NOT looking at a chat
    if (!chatOpenRef.current) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  const resetUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Register a method so ChatDetailScreen can signal it is open/closed
  (UnreadContext as any)._setChatOpen = (open: boolean) => {
    chatOpenRef.current = open;
    if (open) setUnreadCount(0);
  };

  useEffect(() => {
    // Listen for incoming messages from the socket
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
