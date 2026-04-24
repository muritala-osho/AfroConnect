# AfroConnect

## Overview
AfroConnect is a dating and social application designed for the African diaspora. Its primary purpose is to connect individuals within this community. The project is structured into three independent components: a Node.js/Express backend API, an Expo/React Native mobile frontend, and a React-based admin dashboard. Key capabilities include real-time chat, personalized icebreakers, advanced user management and moderation, and robust analytics. The platform aims to foster meaningful connections and build a vibrant community for the African diaspora globally.

## User Preferences
I want iterative development. Ask before making major changes.

## System Architecture
AfroConnect is built as a monorepo containing three distinct applications:

**1. Backend (Node.js + Express):**
*   **Stack**: Node.js, Express, MongoDB (Mongoose for ORM), Socket.io for real-time communication.
*   **Purpose**: Provides RESTful APIs for mobile and admin clients, handles WebSocket connections for chat and calls, and manages data persistence.
*   **Core Features**:
    *   User authentication and authorization (JWT).
    *   Chat functionality with voice notes, media sharing, and reactions.
    *   Personalized icebreaker suggestions based on user interests.
    *   User profile management, including location, interests, and verification status.
    *   Admin API endpoints for user management, content moderation, reports, and analytics.
    *   Notification services (FCM for Android, APNs VoIP for iOS) for calls and general push notifications.
    *   Support ticket system with agent assignment.
    *   Live location updates and daily matching algorithms.
    *   In-app purchase (IAP) endpoints: `POST /subscription/validate-receipt` and `POST /subscription/restore-purchases` for Google Play / Apple IAP receipt validation. Server-side validation uses `GOOGLE_SERVICE_ACCOUNT_JSON` (Android) and `APPLE_IAP_SHARED_SECRET` (iOS); falls back to trusting client if credentials are absent. Both endpoints persist `premium.originalTransactionId` (iOS) and `premium.purchaseToken` (Android) so subscription lifecycle webhooks can locate the user.
    *   Subscription lifecycle webhooks: `POST /subscription/webhook/apple` accepts Apple App Store Server Notifications V2 (`{ signedPayload }` JWS, ES256 leaf-cert verified by default; disable with `APPLE_WEBHOOK_VERIFY_SIGNATURE=false`). `POST /subscription/webhook/google` accepts Google Play Real-Time Developer Notifications via Pub/Sub push (`{ message: { data: base64-json } }`); optionally protected by `GOOGLE_RTDN_TOKEN` query/header. Handlers map renew/cancel/expire/refund/grace events to `User.premium` state via `services/iapWebhookService.js`.
    *   Translation caching (in-memory, 24h TTL, 500-entry LRU) with graceful MYMEMORY WARNING detection returning user-friendly 429 responses.

**2. Frontend (Expo / React Native):**
*   **Stack**: Expo, React Native, TypeScript.
*   **UI/UX**: Features a flat conversation row style (Tinder/Bumble-like), gradient hero cards, and 2x2 benefits grids for specific screens. Uses colored icon bubbles for profile sections, matching the edit profile color scheme. Voice note UX includes preview, pause/resume, variable speed playback, continuous auto-play, and waveform scrubbing. Image viewer supports pinch-to-zoom, double-tap-zoom, and a swipeable gallery.
*   **Technical Implementations**:
    *   Optimistic UI updates for media sends and chat messages.
    *   Integration with `react-native-callkeep` and `react-native-voip-push-notification` for native call UI (CallKit/ConnectionService) even when the app is killed.
    *   Firebase Messaging for background message handling and push notifications.
    *   Video verification flow with liveness detection (blink, head turns) using MediaPipe-style landmark gating and Lottie animations for guided prompts.
    *   Device timezone synchronization for accurate local time display.
    *   Robust error handling with tap-to-retry for failed media uploads.

**3. Admin Dashboard (React + Vite + Tailwind CSS):**
*   **Stack**: React 18, Vite, Tailwind CSS, Recharts, Lucide React, TypeScript.
*   **Purpose**: Provides administrative control over the platform.
*   **UI/UX**: Responsive design with a sidebar navigation. Features dark/light mode toggle.
*   **Features**:
    *   JWT Admin Authentication.
    *   Dashboard with live statistics and charts (Recharts).
    *   User Management: comprehensive table with search, filter, ban, suspend, delete, and verification controls.
    *   Reports & Moderation: content moderation queue for user-reported content (photos, stories, chat images) with approve/reject functionality.
    *   ID Verification: queue for reviewing and approving/rejecting user verification videos.
    *   Analytics: graphs for user growth, engagement, and activity.
    *   Broadcasts: send push notifications to segmented user groups.
    *   Support Desk: centralized system for managing support tickets, with agent assignment and chat interface.
    *   Payments & Revenue tracking.
    *   Dynamic content and user data, removing all mock data for production-ready administration.

## External Dependencies
*   **MongoDB**: Primary database for all application data.
*   **Cloudinary**: Cloud-based media management for image and video uploads.
*   **Agora**: For real-time video and audio communication (calls).
*   **Firebase Cloud Messaging (FCM)**: For sending push notifications to Android devices and handling background messages.
*   **Apple Push Notification Service (APNs) VoIP**: For sending high-priority VoIP push notifications to iOS devices, enabling native call UI.
*   **`react-native-callkeep`**: Integrates with iOS CallKit and Android ConnectionService for native call handling.
*   **`react-native-voip-push-notification`**: For iOS PushKit VoIP token registration and handling.
*   **`lottie-react-native`**: For rendering animated UI elements, particularly in the guided verification flow.
*   **`react-native-iap`**: Handles in-app purchases (Google Play Billing / Apple StoreKit). Dynamically loaded in `iapService.ts` — if it fails to load, the Premium screen shows a "Coming Soon" message with graceful fallback.
*   **`@shopify/flash-list`**: High-performance list rendering used in chat message lists and conversation lists as a FlatList replacement.