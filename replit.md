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
    *   All chat socket emissions (`chat:new-message`) call `message.toJSON()` before emitting, ensuring all schema fields (including GIF fields) are properly serialized for all receivers.
    *   GIF messages persist `gifUrl`, `gifPreview`, `gifWidth`, `gifHeight`, `gifSource` in the Message schema and include them in all socket payloads and REST history responses.

**2. Frontend (Expo / React Native):**
*   **Stack**: Expo, React Native, TypeScript.
*   **UI/UX**: Features a flat conversation row style (Tinder/Bumble-like), gradient hero cards, and 2x2 benefits grids for specific screens. Uses colored icon bubbles for profile sections, matching the edit profile color scheme. Voice note UX includes preview, pause/resume, variable speed playback, continuous auto-play, and waveform scrubbing. Image viewer supports pinch-to-zoom, double-tap-zoom, and a swipeable gallery.
*   **Technical Implementations**:
    *   Optimistic UI updates for media sends and chat messages.
    *   Real-time chat: `handleNewMessage` uses `String()` comparison for matchId to handle ObjectId/string type differences. Uses `isNearBottomRef` to only auto-scroll when user is near the latest message, preventing scroll hijacking when reading history.
    *   Keyboard: on Android (edge-to-edge enabled), `KAVController` uses `keyboardVerticalOffset={insets.bottom}` to account for the navigation bar. `inputPaddingAnim` smoothly animates between `insets.bottom` (keyboard hidden) and `4` (keyboard visible).
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
    *   Premium Members panel: per-user subscription state from `GET /admin/premium-members` showing source (iOS/Android/web/admin), plan, expiry, days-remaining, auto-renew status, last webhook event, transaction identifiers, and active feature flags. Filters by source, plan, status (expiring soon / cancelled-but-active / expired), auto-renew, plus search by name/email/transaction ID/purchase token.
    *   Grant Free Premium: admins can comp users with the full Premium feature set via a header button on the Premium Members panel. AfroConnect ships **a single Premium tier** (no Plus/Gold/Platinum), so the modal only asks for duration + optional reason. Backed by `POST /admin/users/:userId/grant-premium` (`durationDays`, optional `reason` — features come from `iapWebhookService.PREMIUM_FEATURES`, `premium.plan` is set to `admin_grant`, `premium.source` to `admin`), `POST /admin/users/:userId/revoke-premium` (only revokes admin-granted premium — store-billed subscriptions must be cancelled at the store), and `GET /admin/users/lookup?q=` for typeahead search. Granting an active subscription extends the existing expiry. All grants/revokes write `category: SUBSCRIPTION` audit log entries with severity `high`.
    *   Expiring-grants tracking: the Premium Members summary cards include an **Admin Grants** count and a clickable **Grants Expiring** badge (shows admin-granted comps expiring within 7 days; clicking applies the `admin_expiring` status filter). A scheduled job (`runAdminGrantExpiryWarnings` in `backend/utils/scheduledJobs.js`, runs hourly) emails every `User { isAdmin: true }` once per grant when an admin comp is within 7 days of expiry, using `sendAdminGrantExpiryWarningEmail`. The notification flag (`premium.adminGrantExpiryWarningSentAt`) is reset whenever an admin re-grants/extends, so the next expiry triggers a fresh warning.

## Location & Permission Handling
*   **Permission cache**: `frontend/utils/locationPermission.ts` caches the OS foreground location permission in AsyncStorage with a 24h TTL (`getCachedPermissionStatus`, `requestAndCachePermission`, `clearPermissionCache`). Screens that need to know permission state (Discovery, Radar fetch) read from the cache instead of calling `Location.getForegroundPermissionsAsync()` on every focus, which removes the OS round-trip on hot mounts and makes the gate decision deterministic.
*   **Discovery gate**: when `/api/users/nearby` cannot find any usable origin (no request coords, no stored profile coords, no active passport, not in Global mode), it returns `{ users: [], requiresLocation: true }`. The mobile DiscoveryScreen renders a dedicated "Enable location to start discovering" empty state with an `Enable Location` primary button (uses `requestAndCachePermission`) and, for Premium users, a `Browse Globally` fallback. The previous behaviour silently returned an unfiltered list with no distance restriction — confirmed leak, now closed.
*   **New-user signup discovery bug**: `handleShareLocation` previously invoked `loadPotentialMatches()` directly after `updateProfile({ location })`; that captured the stale memoized closure (still no coords) and re-triggered the gate on the very first fetch. The fix sets `setRequiresLocation(false)`, resets `preferencesRef.current = ''`, and lets the dependent `useEffect` re-fire with the fresh `user.location.lat/lng`, which produces a re-memoized `loadPotentialMatches` that hits the backend with the new coordinates.

## Auth & Session Lifecycle
*   **Access token**: 24h JWT, signed with `{ id, tokenVersion, sessionId }` in `backend/routes/auth.js` `generateToken`. Stored client-side in `expo-secure-store` under key `auth_token`.
*   **Refresh token**: opaque random string, hash stored on the `Session` row (`refreshTokenHash`). Stored client-side under key `auth_refresh_token`. The Session has a sliding 30-day TTL (`expireAfterSeconds: 30*24*60*60` on `lastActive`), so any `/auth/refresh` call effectively renews session lifetime.
*   **Refresh-token rotation removed** (previous behaviour caused premature logouts well before the 24h access-token expiry). The `/auth/refresh` route now only bumps `session.lastActive` and issues a new access token; the refresh token itself stays the same for the lifetime of the Session. Rationale: the old "rotate on every refresh" pattern lost the user's session whenever the new token failed to persist client-side (transient network error mid-response, SecureStore write failure, app force-quit between request and storage write, parallel cold-start requests slipping past the singleton in-memory refresh lock). Sessions are still revocable via `/auth/logout` (deletes the Session row) and via the redis revocation set keyed by `revoked:${sessionId}` (checked in both `/auth/refresh` and `middleware/auth.js`). Multi-device login is unaffected — each device has its own Session row with its own refresh token.
*   **Client-side 401 handling**: `frontend/hooks/useApi.ts` (78–108) intercepts 401s on non-`/auth/*` endpoints, calls `tokenManager.refresh()`, and retries the original request once. `frontend/utils/tokenManager.ts` only triggers `onSessionExpiredCallback` (logout) when refresh returns 401/403 or `tokenRevoked: true`; transient network failures or 5xx responses keep tokens intact and let the next request retry.

## Discovery & Matching Behaviour
*   **Daily Super-Like cap** (`backend/routes/match.js` `/swipe` handler): 5/day for Premium, **1/day for Free**. Counter is `superlikecount:<userId>:<YYYY-MM-DD>` in Redis with TTL to UTC midnight; falls back to `user.superLikesDaily.{count, lastReset}` on the User doc when Redis is unavailable. Hitting the cap returns `403 { code: 'SUPERLIKE_LIMIT_REACHED', dailyCap, isPremium, message }` so the client can show an upsell. Free users were previously hard-blocked from super-likes; they now get exactly one per day to taste the feature without diluting Premium scarcity.
*   **Discovery / Radar parity** (`backend/routes/users.js` `/nearby`): the discovery-side `pendingIds` exclusion has been removed. Previously Discovery hid every user with any pending FriendRequest involving the current user, which silently blocked people who had already liked them — those users still appeared on the Love Radar but never on Discovery, producing the "I see them on Radar but not on Discovery" complaint. Discovery and Radar now share the same exclusion set: blocked, blocked-by, already-swiped (left or right), active matches, banned/suspended, incognito (Radar only). When a current-user right-swipe happens on a person who had a pending like to them, the existing `/swipe` handler turns it straight into a Match.
*   **Frontend coords normalization** (`frontend/screens/DiscoveryScreen.tsx` `loadPotentialMatches`): the `/users/nearby` request now reads coordinates from any of `user.location.lat/lng`, `user.location.coordinates.coordinates[0/1]` (GeoJSON Point), or `user.location.coordinates[0/1]` (legacy flat array). Before, only the flat `lat/lng` form was checked, so users whose profile only had the GeoJSON form sent the request without coordinates and silently relied on the backend's stored-coord fallback — fine for results, but it broke distance display on the cards and missed the discovery cache key. With normalization the URL is deterministic from the first call.
*   **Premium instant-load Discovery cache** (`frontend/screens/DiscoveryScreen.tsx`): for Premium users, the last batch of discovery cards (top 20) is persisted to AsyncStorage under `discovery_cache_v1:<userId>` with a 30-min TTL, scoped by `discoveryType` + `selectedCountry`. On the very first mount of the screen, the cache is hydrated synchronously so the deck renders immediately — no spinner — while `/users/nearby` fires in the background to refresh. Free users continue to see the loading state. This is part of the Premium value prop alongside Global, Passport, unlimited likes, etc.

## UI / Performance Notes
*   **Optimistic add/remove for Premium additional locations** (`frontend/screens/ManageLocationsScreen.tsx`): the "+" button no longer awaits the network round-trip + `fetchUser()` before reflecting the change. The new chip is appended to local state and the input is cleared synchronously; `POST /users/me/locations` runs in the background and the list reconciles with the server response on success or rolls back to the previous list (and restores the input text) on failure. Same pattern for delete. `fetchUser()` is fired-and-forgotten so the cached auth-user picks up the new entry without blocking the UI.
*   **Static Premium badge**: `frontend/components/PremiumBadge.tsx` renders a single gold `LinearGradient` circle + award icon — no `react-native-reanimated` shared values, no `withRepeat`, no shimmer loop. Used as-is in `DiscoveryScreen` (rendered per card), `MyProfileScreen`, and `ProfileDetailScreen`. Removed the per-frame work that was causing FPS drops in discovery/list scrolls.
*   **Matches tab loading**: removed the full-screen skeleton grid. The header, "Today's Match" banner, and Matches/Likes tabs render immediately on mount; if `loading && data.length === 0`, a small inline `ActivityIndicator` shows inside the scroll area instead. The previous `Skeleton` import is gone.
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