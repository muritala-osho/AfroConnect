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
- **Gateway**: A gateway proxies API requests to the backend (port 3001) and serves the Expo web frontend (port 3002) from an entry point (port 5000), enabling unified URL handling. Also serves admin dashboard static files at `/admin-web`.

### Core System Design
- **API Hook Pattern**: Custom `useApi` hook for memoized request functions.
- **Photo Normalization**: Utility functions for various image sources.
- **Theme and Language Systems**: Dynamic theme switching with 4 modes (Light, Dark, Grey, System) and multi-language support (12 languages). User-selected accent color (8 options) is applied globally via `useTheme` hook — overrides `primary`, `primaryLight`, `link`, `tabIconSelected`, `like`, and gradient colors across all screens. Interface customization screen (`helo/screens/CustomizeInterfaceScreen.tsx`) uses global theme setters directly from `useTheme` for accent color, font size, chat bubble style, compact mode, animations, and haptic feedback.
- **Error Handling**: Class-based error boundaries for UI crash recovery.
- **Discovery and Matching**: Advanced filtering (location, preferences, excluding already matched/swiped/blocked users), interest overlap scoring (+10 per shared interest), personality matching (+30), and verified user boosts (+5). Local/Global discovery toggle: Local shows nearby matches within maxDistance, Global (premium) shows worldwide users with country picker.
- **Block/Unblock**: Blocking removes match, all chat messages, friend requests, and swipe history for both users. Unblocking only makes user discoverable again without auto-restoring match.
- **Communication**: Real-time chat with message deletion, translation, and reply features. Dynamic chat bubble styles (rounded/sharp/minimal) from `useTheme`. Agora Web SDK integration for robust voice and video calls with state management, ringing tones, busy detection, and offline push notifications.
- **Stories**: Ephemeral stories visible only to matched users who have exchanged messages. Story view tracking with viewer list modal (premium shows names/photos, free shows count).
- **Premium Features**: Stripe integration for premium subscriptions with 12 features: Unlimited Likes, See Who Likes You, 10 Super Likes Daily, Unlimited Rewinds, Incognito Mode, Monthly Free Boost, Global Discovery with Country Picker, Unlimited Voice/Video Calls, Story Viewer Details, Advanced Filters, Premium Badge, No Distance Limits. Animated gold PremiumBadge component (`helo/components/PremiumBadge.tsx`) with dual-layer pulsing glow + shimmer color transition using react-native-reanimated, theme-aware glow colors (warmer amber in dark mode, classic gold in light mode), shown on MyProfileScreen, ProfileDetailScreen, and DiscoveryScreen cards. Stripe checkout saves `stripeCustomerId` via `checkout.session.completed` webhook, with fallback user lookup by `subscription.metadata.userId`. Server-side interval validation whitelists day/week/month/year.
- **Security**: Screenshot protection toggle per chat using expo-screen-capture on native platforms. Setting is synced to both users via backend (Match model `screenshotProtection` field) and real-time socket event (`chat:screenshot-protection` / `chat:screenshot-protection-updated`). When either user enables it, both devices activate screen capture prevention. The other user receives an alert notification.
- **Admin Dashboard**: Two versions - vanilla HTML (`helo/admin-dashboard/index.html` with `css/style.css` and `js/dashboard.js`) served at `/admin-web`, and React-based (`helo/admin-dashboard/App.tsx` with views/). Both connect to backend API via `adminApi.ts`. JWT auth with isAdmin check. Dashboard views: DashboardHome (stats, activity monitoring), UserManagement (search, ban/unban), ReportsQueue (resolve reports), Payments (subscription revenue), IDVerification (approve/reject), Analytics (with Gemini AI), Support tickets. Backend admin routes in `helo/backend/routes/admin.js`.
- **Location Sharing**: Instagram-style map preview bubbles in chat using 3x3 OpenStreetMap tile grid with sub-tile coordinate centering for precise pin placement. Shows centered map with red pin overlay, gradient overlay for text readability, address text, and tap-to-open in native maps app (iOS Maps, Android Geo, web Google Maps).
- **Profile Detail Display**: Full user detail view on ProfileDetailScreen with two sections: Details (gender, looking for, relationship goal, zodiac, job, education, personality type, communication style, love style, relationship status, religion, ethnicity) and Lifestyle (smoking, drinking, workout, pets, has kids, wants kids). Quick info pills show location, gender, zodiac, looking for, relationship goal, and personality type.
- **EditProfileScreen**: Card-based layout with sections: Basic Info, Dating Preferences (looking for, relationship goal, relationship status), About You (zodiac, religion, ethnicity, personality type, communication style, love style), Lifestyle (smoking, drinking, workout, pets, has kids/wants kids toggles), Interests (multi-select with chips), Work & Location, Favorite Song. Uses single `activeModal` state for option modals, `SelectButton` with Feather icons, `ToggleField` for boolean values. Backend User model enums extended to match all frontend options.
- **Chat Typing Indicator**: Animated bouncing dots with scale/opacity animation using Animated API. Theme-aware bubble background (dark/light mode). Shows "typing" label next to dots.
- **Voice Recording**: Tap-to-record flow using modern `Audio.Recording.createAsync()` API with double-start guard. Pulsing red dot animation, duration timer via ref for reliable tracking, "Recording" label, proper cleanup on unmount, iOS audio mode reset after recording. Upload to Cloudinary via `/api/upload/audio` (also aliased as `/api/upload/voice`). Platform-aware MIME type detection from file extension with `application/octet-stream` fallback for Android. Backend accepts `audio/x-caf` for iOS. Minimum 1-second duration check with user feedback. Audio playback uses `playingAudioIdRef` (ref) alongside `playingAudioId` (state) to avoid stale closure in `playAudio` — ref tracks current state for pause/resume logic, state triggers UI re-renders. `updatePlayingId` helper keeps both in sync.
- **Compatibility System**: Quiz-based compatibility scoring across 5 categories (lifestyle, values, personality, relationship, future). Score displayed on ProfileDetailScreen with percentage, match quality badge, and per-category breakdown bars.
- **User TTL Safety**: Unverified users auto-deleted after 24 hours (TTL index on `expireAt`). Verified users have `expireAt` cleared on save via pre-save hook. Startup migration clears stale `expireAt` values on verified users.
- **Social Media Screen**: `SocialMediaScreen.tsx` accessible from Settings > "Follow Us". Lists AfroConnect social handles (Instagram, Twitter/X, TikTok, Facebook, YouTube, LinkedIn, Website) with branded icons, tap-to-open via Linking.
- **MatchesScreen Performance**: Uses FlatList with masonry grid layout, React.memo for card items, memoized callbacks with `useCallback`, memoized column splitting via `useMemo`, `getItemLayout`, `maxToRenderPerBatch`, `windowSize`, `removeClippedSubviews`, and `initialNumToRender` optimizations.

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
