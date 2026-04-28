export interface MessageReaction {
  user: string | { _id: string };
  emoji: string;
}

export interface Message {
  _id: string;
  sender: string | { _id: string };
  content?: string;
  text?: string;
  type: "text" | "image" | "video" | "audio" | "system" | "location" | "call" | "story_reaction" | "story_reply" | "gif";
  imageUrl?: string;
  videoUrl?: string;
  gifUrl?: string;
  gifPreview?: string;
  gifWidth?: number;
  gifHeight?: number;
  gifSource?: "tenor" | "giphy";
  audioUrl?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  createdAt: string;
  status?: "sent" | "delivered" | "seen";
  replyTo?: {
    messageId: string;
    content: string;
    type: string;
    senderName: string;
  };
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  reactions?: MessageReaction[];
  viewOnce?: boolean;
  viewOnceOpenedBy?: string[];
  edited?: boolean;
  editedAt?: string;
  seenAt?: string;
  storyReaction?: {
    storyId: string;
    emoji?: string;
    storyType?: string;
    storyPreview?: string;
  };
}
