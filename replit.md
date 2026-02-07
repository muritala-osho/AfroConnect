# AfroConnect - Dating App

## Overview
AfroConnect is a modern, location-based dating application built with React Native (Expo) for cross-platform mobile and web support. The app enables users to discover potential matches through swipe-based interactions, real-time chat, voice/video calls, and social features like stories. It targets African and international communities with support for 12 languages.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54, supporting iOS, Android, and web platforms
- **Navigation**: React Navigation v7 with native stack navigators and custom animated bottom tab bar
- **State Management**: React Context API for global state (auth, theme, language) with AsyncStorage for persistence
- **UI Components**: Custom themed component system with light/dark mode support, consistent design tokens for spacing, typography, and colors
- **Animations**: Reanimated v4 for smooth gestures and transitions, haptic feedback via expo-haptics
- **Image Handling**: expo-image for optimized loading with SafeImage wrapper for source normalization

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database**: MongoDB with Mongoose ODM for data modeling
- **Authentication**: JWT-based token auth with bcryptjs password hashing, Google OAuth support
- **Real-time**: Socket.io for WebSocket connections (chat, presence, call signaling)
- **File Storage**: Multer for uploads, Cloudinary for cloud image storage
- **Email**: Nodemailer for transactional emails (OTP, password resets)

### Gateway Architecture
The system uses a gateway proxy pattern:
- **Gateway** (port 5000): Entry point that routes requests
- **Backend API** (port 3001): Express server handling `/api/*` and `/socket.io/*`
- **Expo Web** (port 3002): React Native web bundle

This architecture enables unified URL handling where the gateway proxies API requests to the backend and serves the frontend for all other routes.

### Key Design Patterns
- **API Hook Pattern**: Custom `useApi` hook with memoized request functions to prevent re-renders
- **Photo Normalization**: Utility functions handle various image source formats (Cloudinary, local, URIs)
- **Theme System**: ThemeProvider with system preference detection and manual override
- **Language System**: LanguageProvider supporting 12 languages with profile sync capability
- **Error Boundaries**: Class-based error boundary with fallback UI for crash recovery

### Core Features
- Swipe-based matching with location filtering and preference scoring (excludes already-matched users)
- Real-time messaging with typing indicators, read receipts, reactions, and multiple message types (text, image, audio, location)
- Chat enhancements: 17 custom themes, voice recording, location sharing, image upload, emoji picker, AI message suggestions, report user
- Voice/video calling via Agora RTC integration
- Stories feature for ephemeral content sharing
- Profile verification with multi-step photo process
- Profile visitors screen with premium gating (blurred photos and hashed names for non-premium users)
- Admin dashboard for moderation and analytics
- Push notifications via Expo notifications service

### Recent Updates (February 2026)
- Fixed discovery filtering: excludes matched users, swiped users, AND pending friend requests
- Distance filtering for free users now uses saved preference (default 50km) instead of 10000km
- Gender preference filter properly handles 'male', 'female', and 'both' values
- Fixed real-time chat: chat rooms are joined via socket, messages broadcast to both room and receiver
- All socket message emissions now include matchId in payload for proper message routing
- Fixed story viewing: my-stories endpoint now returns imageUrl/mediaUrl fallback fields
- Fixed report user: schema accepts matchId field, reason validation is case-insensitive
- Upload improvements: expanded audio MIME types, flexible multer middleware for voice uploads
- Blocked users page redesigned with confirmation dialog, header, safe area insets
- Matches tab: improved user ID comparison to handle both _id and id formats
- Typing indicator properly emits 'chat:typing' with chatId parameter
- Stories open visibility: any authenticated user can view stories (blocked users excluded), `/active` endpoint shows all users' stories
- Discovery filter: removed `includeAll` bypass, backend properly filters matched/swiped users
- Story reply: added POST `/stories/:storyId/reply` route, sends chat message if matched or socket notification if not
- Story share: shares friendly app promo message instead of raw Cloudinary URL, works for text stories too
- Premium/Stripe: installed `stripe-replit-sync` dependency, Stripe schema initializes correctly
- ProfileDetailScreen: complete redesign with hero photo gradient, floating action bar (pass/message/like/superlike), quick info pills, photo gallery, colored interest tags, report button
- Metro memory increased to 1024MB to prevent OOM crashes
- UserDistanceMap: fixed location format handling (GeoJSON + lat/lng) and photo URI extraction
- Rewind: premium-gated on both DiscoveryScreen and SwipeScreen with upgrade prompts
- Passport Match: backend passportLocation field on User model, POST /users/passport-location route, nearby route uses passport coords for premium users; frontend modal with 10 city presets (NY, London, Paris, Lagos, Nairobi, Tokyo, Dubai, São Paulo, Johannesburg, Accra)
- See Who Likes You: MatchesScreen blurs photos (blurRadius=15) and masks names for free users, lock icon overlay, tap navigates to Premium
- Unlimited Likes: frontend shows "Out of Likes" upgrade prompt when 403 swipe limit hit
- Chat real-time sync verified: socket.io broadcasts to room + receiver, frontend listens on chat:new-message and message:new, auto-scrolls, no refresh needed
- Discovery + Radar filtering: all excluded IDs (swiped, matched, blocked, pending) normalized to strings with deduplication to fix MongoDB $nin type mismatch
- Push notifications: implemented Expo push notifications via expo-server-sdk for new chat messages (offline receiver) and incoming calls (offline target); utils/pushNotifications.js utility
- Call flow: socket call:initiate → call:incoming to target → IncomingCallHandler shows UI; push notification sent if target offline; call:accept/decline/end/missed handlers with chat message logging
- Stripe pricing: backend maps frontend-friendly IDs (price_daily/weekly/monthly/yearly) to actual Stripe prices by looking up active prices by interval
- AI model: switched from gpt-4 to gpt-4o-mini for translate and chat-suggestions endpoints (more reliable, cheaper)
- Chat long-press context menu: Reply, Translate, Delete for Me, Delete for Everyone (sender only, premium, 15min window)
- Swipe-left-to-reply gesture on messages using Animated + PanResponder, with reply icon appearing on swipe
- Reply functionality: reply preview bar above input, replyTo data in message payload, WhatsApp-style reply preview inside message bubbles
- AI translation: translate modal with 24 languages (incl. Swahili, Amharic, Yoruba, Hausa, Igbo, Zulu, Xhosa, Twi, Wolof, Shona) using /ai/translate endpoint
- Message deletion: delete for me removes from local state, delete for everyone shows "This message was deleted" system message; socket listener for real-time delete sync

## External Dependencies

### Cloud Services
- **MongoDB Atlas**: Primary database hosting
- **Cloudinary**: Image upload, storage, and transformation
- **Agora**: Real-time voice and video calling SDK
- **Stripe**: Payment processing for premium features
- **SendGrid**: Transactional email delivery

### Key npm Packages
- **expo** (54.x): Core development framework
- **mongoose** (8.x): MongoDB object modeling
- **socket.io** (4.x): WebSocket server implementation
- **jsonwebtoken**: JWT token generation and verification
- **agora-rtc-sdk-ng**: Browser-based video/voice calls
- **react-native-reanimated** (4.x): Animation library

### Development Tools
- **EAS Build**: Expo Application Services for native builds
- **Babel with module-resolver**: Path aliasing (@/ prefix)
- **ESLint + Prettier**: Code formatting and linting