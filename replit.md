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

### Recent Updates (January 2026)
- Added location message type support with coordinates and address display
- Implemented AI chat suggestions via OpenAI GPT-4 with template fallback
- Enhanced profile visitors page with premium gating features
- Updated discovery to exclude users you've already matched with
- Voice message recording with duration tracking and Cloudinary upload

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