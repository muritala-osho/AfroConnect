import {
  Phone,
  Video,
  MoreVertical,
  ChevronLeft,
  Send,
  Mic,
  Smile,
  Paperclip,
  Check,
  CheckCheck,
  Bot,
  Heart,
  Flame,
  Shield,
  Sparkles,
} from "lucide-react";

const THEME = {
  bg: "#0D1117",
  surface: "#161B22",
  surfaceElevated: "#21262D",
  primary: "#10B981",
  primaryLight: "#34D399",
  text: "#FFFFFF",
  textSecondary: "#8B949E",
  border: "#30363D",
  online: "#00D856",
  error: "#FF6B6B",
};

const messages = [
  {
    id: "sys1",
    type: "system",
    text: "You matched with Amara! 🎉",
    date: "Monday, April 1",
  },
  {
    id: "1",
    sender: "them",
    text: "Hey! I saw we both love Afrobeats 🎶 What's your all-time favourite track?",
    time: "10:32 AM",
    status: "seen",
  },
  {
    id: "2",
    sender: "me",
    text: "Oh wow great taste! I'd say 'Essence' by Wizkid feat. Tems is unbeatable 🔥",
    time: "10:34 AM",
    status: "seen",
  },
  {
    id: "3",
    sender: "them",
    text: "Yes!! That song is everything 😍 Have you seen them live?",
    time: "10:35 AM",
    status: "seen",
  },
  {
    id: "4",
    sender: "me",
    text: "Not yet but it's on my bucket list! You?",
    time: "10:36 AM",
    status: "seen",
    reaction: "❤️",
  },
  {
    id: "5",
    sender: "them",
    text: "I saw Tems in London last year — absolutely magical ✨ We should go together someday!",
    time: "10:38 AM",
    status: "seen",
  },
  {
    id: "6",
    sender: "me",
    text: "That sounds amazing! When are you free? 🌍",
    time: "10:39 AM",
    status: "delivered",
  },
];

const AI_SUGGESTIONS = [
  "Tell me more about your time in London!",
  "What other artists do you love? 🎵",
  "I'd love to know what you do for fun 😊",
];

function MessageBubble({ msg }: { msg: any }) {
  const isMe = msg.sender === "me";

  if (msg.type === "system") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "16px 0" }}>
        <div style={{
          background: `${THEME.primary}18`,
          border: `1px solid ${THEME.primary}30`,
          borderRadius: 20,
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <Heart size={12} color={THEME.primary} fill={THEME.primary} />
          <span style={{ fontSize: 12, color: THEME.primary, fontWeight: 600 }}>{msg.text}</span>
        </div>
        <span style={{ fontSize: 10, color: THEME.textSecondary, marginTop: 4 }}>{msg.date}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isMe ? "flex-end" : "flex-start",
      marginBottom: 6,
      paddingLeft: isMe ? 48 : 12,
      paddingRight: isMe ? 12 : 48,
    }}>
      <div style={{ position: "relative" }}>
        <div style={{
          background: isMe
            ? `linear-gradient(135deg, ${THEME.primary}, #059669)`
            : THEME.surface,
          borderRadius: isMe
            ? "18px 18px 4px 18px"
            : "18px 18px 18px 4px",
          padding: "10px 14px",
          border: isMe ? "none" : `1px solid ${THEME.border}`,
          maxWidth: 240,
          position: "relative",
        }}>
          <p style={{
            margin: 0,
            fontSize: 14.5,
            color: THEME.text,
            lineHeight: 1.45,
            fontWeight: 400,
          }}>
            {msg.text}
          </p>
        </div>
        {msg.reaction && (
          <div style={{
            position: "absolute",
            bottom: -10,
            right: isMe ? 4 : undefined,
            left: isMe ? undefined : 4,
            background: THEME.surfaceElevated,
            border: `1px solid ${THEME.border}`,
            borderRadius: 10,
            padding: "1px 5px",
            fontSize: 11,
          }}>
            {msg.reaction}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, paddingRight: isMe ? 2 : 0, paddingLeft: isMe ? 0 : 2 }}>
        <span style={{ fontSize: 10.5, color: THEME.textSecondary }}>{msg.time}</span>
        {isMe && msg.status === "seen" && <CheckCheck size={12} color={THEME.primary} />}
        {isMe && msg.status === "delivered" && <CheckCheck size={12} color={THEME.textSecondary} />}
        {isMe && msg.status === "sent" && <Check size={12} color={THEME.textSecondary} />}
      </div>
    </div>
  );
}

export function ChatDetail() {
  return (
    <div style={{
      width: 390,
      height: 844,
      background: THEME.bg,
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: "hidden",
      position: "relative",
      color: THEME.text,
    }}>
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 20, paddingTop: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: THEME.text }}>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2 }}>
            {[3, 5, 7, 9].map((h, i) => (
              <div key={i} style={{ width: 3, height: h, background: i < 3 ? THEME.text : "rgba(255,255,255,0.3)", borderRadius: 1 }} />
            ))}
          </div>
          <div style={{ width: 24, height: 12, border: `1.5px solid rgba(255,255,255,0.5)`, borderRadius: 3, padding: "1px", display: "flex", alignItems: "center" }}>
            <div style={{ width: "70%", height: "100%", background: "#4ade80", borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{
        background: THEME.surface,
        borderBottom: `1px solid ${THEME.border}`,
        padding: "10px 14px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}>
        {/* Back */}
        <button style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex", alignItems: "center", color: THEME.text }}>
          <ChevronLeft size={26} color={THEME.text} />
        </button>

        {/* Avatar + info (centered, takes up the middle) */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {/* Gradient ring — online */}
            <div style={{
              position: "absolute",
              inset: -2.5,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.primaryLight})`,
            }} />
            <div style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #e11d48, #9333ea)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              fontWeight: 700,
              color: "white",
              border: `2.5px solid ${THEME.surface}`,
              zIndex: 1,
            }}>
              AO
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: THEME.text, letterSpacing: -0.2 }}>Amara Osei</span>
              <div style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                background: THEME.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Shield size={8} color="white" fill="white" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: THEME.online }} />
              <span style={{ fontSize: 12, color: THEME.online, fontWeight: 500 }}>Online now</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button style={{
            width: 38, height: 38, borderRadius: 12,
            background: `${THEME.primary}15`,
            border: `1px solid ${THEME.primary}30`,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <Phone size={18} color={THEME.primary} />
          </button>
          <button style={{
            width: 38, height: 38, borderRadius: 12,
            background: `${THEME.primary}15`,
            border: `1px solid ${THEME.primary}30`,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <Video size={18} color={THEME.primary} />
          </button>
          <button style={{
            width: 38, height: 38, borderRadius: 12,
            background: THEME.surfaceElevated,
            border: `1px solid ${THEME.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <MoreVertical size={18} color={THEME.textSecondary} />
          </button>
        </div>
      </div>

      {/* Compatibility banner */}
      <div style={{
        background: `linear-gradient(90deg, ${THEME.primary}12, ${THEME.primary}06)`,
        borderBottom: `1px solid ${THEME.primary}20`,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Flame size={13} color={THEME.primary} fill={`${THEME.primary}60`} />
          <span style={{ fontSize: 12, color: THEME.textSecondary }}>
            <span style={{ color: THEME.primary, fontWeight: 600 }}>94% match</span> based on shared interests
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {["🎵", "✈️", "💃"].map((e, i) => (
            <span key={i} style={{ fontSize: 13 }}>{e}</span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 6px" }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Typing indicator */}
        <div style={{ paddingLeft: 14, paddingBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            background: THEME.surface,
            border: `1px solid ${THEME.border}`,
            borderRadius: "18px 18px 18px 4px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: THEME.textSecondary,
                opacity: i === 1 ? 1 : 0.5,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: THEME.textSecondary }}>Amara is typing...</span>
        </div>
      </div>

      {/* AI suggestions strip */}
      <div style={{
        background: THEME.surface,
        borderTop: `1px solid ${THEME.border}`,
        padding: "8px 12px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Bot size={13} color={THEME.primary} />
          <span style={{ fontSize: 11, color: THEME.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>AI Suggestions</span>
          <Sparkles size={11} color={THEME.primary} />
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {AI_SUGGESTIONS.map((s, i) => (
            <div key={i} style={{
              background: `${THEME.primary}12`,
              border: `1px solid ${THEME.primary}30`,
              borderRadius: 16,
              padding: "6px 12px",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 12.5, color: THEME.primary, fontWeight: 500 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div style={{
        background: THEME.surface,
        borderTop: `1px solid ${THEME.border}`,
        padding: "10px 12px 28px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          {/* Attach */}
          <button style={{
            width: 40, height: 40, borderRadius: 14,
            background: THEME.surfaceElevated,
            border: `1px solid ${THEME.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}>
            <Paperclip size={18} color={THEME.primary} />
          </button>

          {/* Text input wrapper */}
          <div style={{
            flex: 1,
            background: THEME.surfaceElevated,
            borderRadius: 20,
            border: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "flex-end",
            padding: "8px 10px 8px 14px",
            gap: 8,
            minHeight: 42,
          }}>
            <div style={{ flex: 1, fontSize: 14.5, color: `${THEME.textSecondary}80`, lineHeight: 1.4, paddingBottom: 1 }}>
              Type a message...
            </div>
            {/* Emoji */}
            <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
              <Smile size={20} color={THEME.textSecondary} />
            </button>
          </div>

          {/* AI button */}
          <button style={{
            width: 40, height: 40, borderRadius: 14,
            background: THEME.surfaceElevated,
            border: `1px solid ${THEME.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}>
            <Bot size={18} color={THEME.textSecondary} />
          </button>

          {/* Mic / Send */}
          <button style={{
            width: 42, height: 42, borderRadius: 15,
            background: `linear-gradient(135deg, ${THEME.primary}, #059669)`,
            border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}>
            <Mic size={19} color="white" />
          </button>
        </div>
      </div>
    </div>
  );
}
