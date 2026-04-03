import { Search, MoreVertical, CheckCheck, Phone, Video, Camera, Plus, Check } from "lucide-react";

const conversations = [
  {
    id: "1",
    name: "Amara Osei",
    lastMessage: "That sounds amazing! When are you free? 🌍",
    time: "2m",
    unread: 3,
    online: true,
    verified: true,
    avatar: "AO",
    avatarColor: "#e11d48",
    isRead: false,
  },
  {
    id: "2",
    name: "Kofi Mensah",
    lastMessage: "Haha yes! Lagos or Accra next trip?",
    time: "18m",
    unread: 0,
    online: true,
    verified: true,
    avatar: "KM",
    avatarColor: "#7c3aed",
    isRead: true,
  },
  {
    id: "3",
    name: "Zara Diallo",
    lastMessage: "I love Afrobeats too, what's your fav album?",
    time: "1h",
    unread: 1,
    online: false,
    verified: false,
    avatar: "ZD",
    avatarColor: "#0891b2",
    isRead: false,
  },
  {
    id: "4",
    name: "Emeka Nwosu",
    lastMessage: "You: Sounds good, let's connect 🤝",
    time: "3h",
    unread: 0,
    online: false,
    verified: true,
    avatar: "EN",
    avatarColor: "#059669",
    isRead: true,
  },
  {
    id: "5",
    name: "Fatima Bah",
    lastMessage: "Sending you good vibes from Dakar ✨",
    time: "Yesterday",
    unread: 0,
    online: true,
    verified: false,
    avatar: "FB",
    avatarColor: "#d97706",
    isRead: true,
  },
  {
    id: "6",
    name: "Kwame Asante",
    lastMessage: "The diaspora meetup is this Saturday!",
    time: "Yesterday",
    unread: 0,
    online: false,
    verified: true,
    avatar: "KA",
    avatarColor: "#db2777",
    isRead: true,
  },
  {
    id: "7",
    name: "Nadia Traoré",
    lastMessage: "You: I'll check the restaurant out 🍽️",
    time: "Mon",
    unread: 0,
    online: false,
    verified: false,
    avatar: "NT",
    avatarColor: "#7c3aed",
    isRead: true,
  },
];

const stories = [
  { id: "me", name: "Your Story", avatar: "ME", color: "#8b5cf6", hasStory: false, isMe: true },
  { id: "1", name: "Amara", avatar: "AO", color: "#e11d48", hasStory: true },
  { id: "2", name: "Kofi", avatar: "KM", color: "#7c3aed", hasStory: true },
  { id: "3", name: "Zara", avatar: "ZD", color: "#0891b2", hasStory: true },
  { id: "4", name: "Emeka", avatar: "EN", color: "#059669", hasStory: false },
];

const recentCalls = [
  { id: "1", name: "Amara", avatar: "AO", color: "#e11d48", type: "video", missed: false },
  { id: "2", name: "Kofi", avatar: "KM", color: "#7c3aed", type: "voice", missed: true },
  { id: "3", name: "Zara", avatar: "ZD", color: "#0891b2", type: "video", missed: false },
];

function StoryRing({ hasStory, isMe }: { hasStory: boolean; isMe?: boolean }) {
  if (isMe) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: -2,
          right: -2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#8b5cf6",
          border: "2px solid #1a1a2e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <Plus size={10} color="white" strokeWidth={3} />
      </div>
    );
  }
  if (!hasStory) return null;
  return null;
}

export function ChatsScreen() {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', -apple-system, sans-serif",
        overflow: "hidden",
        position: "relative",
        color: "white",
      }}
    >
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 20, paddingTop: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2 }}>
            {[3, 5, 7, 9].map((h, i) => (
              <div key={i} style={{ width: 3, height: h, background: i < 3 ? "#fff" : "rgba(255,255,255,0.3)", borderRadius: 1 }} />
            ))}
          </div>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
            <path d="M8 2.4C5.6 2.4 3.44 3.36 1.84 4.96L0 3.12C2.08 1.12 4.88 0 8 0s5.92 1.12 8 3.12L14.16 4.96C12.56 3.36 10.4 2.4 8 2.4z" opacity="0.4"/>
            <path d="M8 5.6c-1.6 0-3.04.64-4.08 1.68L2.24 5.6C3.6 4.24 5.68 3.2 8 3.2s4.4 1.04 5.76 2.4l-1.68 1.68C11.04 6.24 9.6 5.6 8 5.6z" opacity="0.7"/>
            <path d="M8 8.8c-.88 0-1.68.32-2.28.88L8 12l2.28-2.32C9.68 9.12 8.88 8.8 8 8.8z"/>
          </svg>
          <div style={{ width: 24, height: 12, border: "1.5px solid rgba(255,255,255,0.6)", borderRadius: 3, padding: "1px 1px", display: "flex", alignItems: "center" }}>
            <div style={{ width: "70%", height: "100%", background: "#4ade80", borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 16, paddingBottom: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#fff", letterSpacing: -0.5 }}>Chats</h1>
        <button style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(255,255,255,0.08)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <MoreVertical size={20} color="rgba(255,255,255,0.9)" />
        </button>
      </div>

      {/* Stories section */}
      <div style={{ paddingLeft: 20, paddingBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>Stories</span>
      </div>
      <div style={{ display: "flex", gap: 14, paddingLeft: 16, paddingRight: 16, paddingBottom: 14, overflowX: "auto" }}>
        {stories.map((s) => (
          <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 60, cursor: "pointer" }}>
            <div style={{ position: "relative" }}>
              {s.hasStory && (
                <div style={{
                  position: "absolute", inset: -2.5,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #f97316, #ec4899, #8b5cf6)",
                  zIndex: 0,
                }} />
              )}
              <div style={{
                position: "relative",
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: s.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                color: "white",
                border: s.hasStory ? "2.5px solid #16213e" : "2px solid rgba(255,255,255,0.1)",
                zIndex: 1,
              }}>
                {s.avatar}
                <StoryRing hasStory={s.hasStory} isMe={s.isMe} />
              </div>
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 500, textAlign: "center", maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.name}
            </span>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 14,
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 10,
          paddingBottom: 10,
        }}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <span style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", flex: 1 }}>Search messages...</span>
        </div>
      </div>

      {/* Recent Calls */}
      <div style={{ paddingLeft: 20, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Phone size={14} color="#8b5cf6" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>Recent Calls</span>
        </div>
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingRight: 16 }}>
          {recentCalls.map((call) => (
            <div key={call.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 54, cursor: "pointer" }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: call.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "white" }}>
                  {call.avatar}
                </div>
                <div style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: call.missed ? "#ef4444" : "#22c55e",
                  border: "2px solid #16213e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {call.type === "video"
                    ? <Video size={9} color="white" />
                    : <Phone size={9} color="white" />
                  }
                </div>
              </div>
              <span style={{ fontSize: 10.5, color: call.missed ? "#ef4444" : "rgba(255,255,255,0.6)", fontWeight: 500 }}>{call.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages label */}
      <div style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 4, paddingTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8 }}>Messages</span>
        <span style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 600 }}>Requests (2)</span>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {conversations.map((conv, index) => (
          <div
            key={conv.id}
            style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 11,
              paddingBottom: 11,
              borderBottom: index < conversations.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              cursor: "pointer",
              background: conv.unread > 0 ? "rgba(139,92,246,0.04)" : "transparent",
            }}
          >
            {/* Avatar */}
            <div style={{ position: "relative", marginRight: 13, flexShrink: 0 }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: conv.avatarColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                color: "white",
              }}>
                {conv.avatar}
              </div>
              {conv.online && (
                <div style={{
                  position: "absolute",
                  bottom: 1,
                  right: 1,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#22c55e",
                  border: "2.5px solid #16213e",
                }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    fontSize: 15.5,
                    fontWeight: conv.unread > 0 ? 700 : 500,
                    color: "#fff",
                    letterSpacing: -0.2,
                  }}>
                    {conv.name}
                  </span>
                  {conv.verified && (
                    <div style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "#8b5cf6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <Check size={8} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 12,
                  color: conv.unread > 0 ? "#8b5cf6" : "rgba(255,255,255,0.35)",
                  fontWeight: conv.unread > 0 ? 600 : 400,
                  flexShrink: 0,
                  marginLeft: 8,
                }}>
                  {conv.time}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  fontSize: 13.5,
                  color: conv.unread > 0 ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)",
                  fontWeight: conv.unread > 0 ? 500 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: conv.unread > 0 ? 220 : 250,
                }}>
                  {conv.lastMessage}
                </span>
                {conv.unread > 0 ? (
                  <div style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    background: "#8b5cf6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingLeft: 6,
                    paddingRight: 6,
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>{conv.unread}</span>
                  </div>
                ) : conv.isRead ? null : (
                  <CheckCheck size={16} color="#8b5cf6" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
