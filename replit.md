# AfroConnect - Dating App

## Overview
AfroConnect is a modern, location-based dating application built with React Native (Expo) for cross-platform mobile and web. It enables users to discover potential matches through swipe-based interactions, real-time chat, voice/video calls, and social features like stories. The app targets African and international communities with support for 12 languages. Its primary purpose is to connect individuals in these communities, offering a rich set of communication and discovery tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK, supporting iOS, Android, and web.
- **Navigation**: React Navigation with native stack navigators and a custom animated bottom tab bar.
- **State Management**: React Context API for global state, persisted with AsyncStorage.
- **UI/UX**: Custom themed component system with light/dark mode, consistent design tokens for spacing, typography, and colors. Reanimated for smooth animations and gestures, with haptic feedback. Optimized image loading with `expo-image`.
- **Key Features**: Swipe-based matching, real-time messaging with rich features (typing indicators, read receipts, reactions, various message types, AI suggestions), Agora-powered voice/video calls, ephemeral stories, profile verification, profile visitors screen, and push notifications via Expo.

### Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Database**: MongoDB with Mongoose ODM.
- **Authentication**: JWT-based token authentication with bcryptjs and Google OAuth.
- **Real-time**: Socket.io for WebSockets (chat, presence, call signaling).
- **File Storage**: Multer for uploads, Cloudinary for cloud image storage.
- **Email**: Nodemailer for transactional emails.
- **Gateway**: A gateway proxies API requests to the backend (port 3001) and serves the Expo web frontend (port 3002) from an entry point (port 5000), enabling unified URL handling.

### Core System Design
- **API Hook Pattern**: Custom `useApi` hook for memoized request functions.
- **Photo Normalization**: Utility functions for various image sources.
- **Theme and Language Systems**: Dynamic theme switching with 4 modes (Light, Dark, Grey, System) and multi-language support (12 languages). User-selected accent color (8 options) is applied globally via `useTheme` hook — overrides `primary`, `primaryLight`, `link`, `tabIconSelected`, `like`, and gradient colors across all screens. Interface customization screen (`helo/screens/CustomizeInterfaceScreen.tsx`) for accent color, font size, chat bubble style, compact mode, animations, and haptic feedback preferences.
- **Error Handling**: Class-based error boundaries for UI crash recovery.
- **Discovery and Matching**: Advanced filtering (location, preferences, excluding already matched/swiped/blocked users), interest overlap scoring (+10 per shared interest), personality matching (+30), and verified user boosts (+5). Local/Global discovery toggle: Local shows nearby matches within maxDistance, Global (premium) shows worldwide users with country picker.
- **Block/Unblock**: Blocking removes match, all chat messages, friend requests, and swipe history for both users. Unblocking only makes user discoverable again without auto-restoring match.
- **Communication**: Real-time chat with message deletion, translation, and reply features. Agora Web SDK integration for robust voice and video calls with state management, ringing tones, busy detection, and offline push notifications.
- **Stories**: Ephemeral stories visible only to matched users who have exchanged messages. Story view tracking with viewer list modal (premium shows names/photos, free shows count).
- **Premium Features**: Stripe integration for premium subscriptions with 12 features: Unlimited Likes, See Who Likes You, 10 Super Likes Daily, Unlimited Rewinds, Incognito Mode, Monthly Free Boost, Global Discovery with Country Picker, Unlimited Voice/Video Calls, Story Viewer Details, Advanced Filters, Premium Badge, No Distance Limits. Animated gold PremiumBadge component (`helo/components/PremiumBadge.tsx`) with pulsing glow shown on MyProfileScreen, ProfileDetailScreen, and DiscoveryScreen cards.
- **Security**: Screenshot protection toggle per chat using expo-screen-capture on native platforms. Per-chat preference persisted via AsyncStorage.
- **Admin Dashboard**: Full admin web panel at `/admin-web` with real API integration (`helo/admin-dashboard/services/adminApi.ts`). JWT auth with isAdmin check, auto-logout on 401. Views: DashboardHome (stats, activity monitoring), UserManagement (search, ban/unban), ReportsQueue (resolve reports), Payments (subscription revenue), IDVerification (approve/reject). Backend endpoints in `helo/backend/routes/admin.js` including DELETE stories and GET single user detail.
- **Location Sharing**: Instagram-style map preview bubbles in chat using OpenStreetMap tiles. Shows static map thumbnail with pin overlay, address text, and tap-to-open in native maps app.
- **Profile Detail Display**: Full user detail view on ProfileDetailScreen with two sections: Details (gender, looking for, relationship goal, zodiac, job, education, personality type, communication style, love style, relationship status, religion, ethnicity) and Lifestyle (smoking, drinking, workout, pets, has kids, wants kids). Quick info pills show location, gender, zodiac, looking for, relationship goal, and personality type.
- **Chat Typing Indicator**: Animated bouncing dots with scale/opacity animation using Animated API. Theme-aware bubble background (dark/light mode). Shows "typing" label next to dots.
- **Voice Recording**: Tap-to-record flow with pulsing red dot animation, duration timer, "Recording" label, proper cleanup on unmount, iOS audio mode reset after recording, upload to Cloudinary via `/api/upload/audio`.
- **Compatibility System**: Quiz-based compatibility scoring across 5 categories (lifestyle, values, personality, relationship, future). Score displayed on ProfileDetailScreen with percentage, match quality badge, and per-category breakdown bars.
- **User TTL Safety**: Unverified users auto-deleted after 24 hours (TTL index on `expireAt`). Verified users have `expireAt` cleared on save via pre-save hook. Startup migration clears stale `expireAt` values on verified users.

## External Dependencies

### Cloud Services
- **MongoDB Atlas**: Database hosting.
- **Cloudinary**: Image and video storage, transformation, and delivery.
- **Agora**: Real-time voice and video calling infrastructure.
- **Stripe**: Payment processing.
- **SendGrid**: Transactional email service.
- **Expo Notifications Service**: Push notifications.

### Key npm Packages
- **expo**: Core cross-platform development framework.
- **mongoose**: MongoDB object modeling tool.
- **socket.io**: WebSocket library for real-time communication.
- **jsonwebtoken**: For handling JSON Web Tokens.
- **agora-rtc-sdk-ng**: Agora's SDK for web-based RTC.
- **react-native-reanimated**: Advanced animation library for React Native.
- **expo-av**: For audio and video playback within the app.
- **expo-screen-capture**: For managing screenshot protection.
- **expo-image**: Optimized image loading component.
- **expo-haptics**: For haptic feedback.
- **react-navigation**: For app navigation.

### Development Tools
- **EAS Build**: Expo Application Services for native application builds.
- **Babel with module-resolver**: For path aliasing.
- **ESLint + Prettier**: For code quality and formatting.