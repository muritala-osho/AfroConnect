# AfroConnect — Project Structure

## Recent Changes
- **CallKit (iOS) / ConnectionService (Android) — native call UI when app is killed**:
  - Installed `react-native-callkeep` (wraps CallKit on iOS and ConnectionService on Android) and `react-native-voip-push-notification` (PushKit VoIP token for iOS).
  - `frontend/services/callkeep.ts` (NEW): Wrapper service — `initCallKeep()`, `displayIncomingCall()`, `endCallKeepCall()`, `reportCallEnded()`, `setCallActive()`, `setupCallKeepListeners()`, `removeCallKeepListeners()`. Calls `RNCallKeep.displayIncomingCall()` so the OS-level native incoming call screen appears regardless of app state.
  - `frontend/services/voipPush.ts` (NEW): Registers for iOS PushKit VoIP push token and handles `notification` events when the app is killed — immediately calls `displayIncomingCall()` to show CallKit UI before any JS UI renders.
  - `frontend/components/IncomingCallHandler.tsx` (UPDATED): Now calls `displayIncomingCall()` on every incoming call for both foreground and background. Sets up `setupCallKeepListeners` to handle native Accept/Decline button presses. In-app modal and native CallKit screen are shown simultaneously — native accept/decline routes through socket then navigates to the call screen.
  - `frontend/App.tsx` (UPDATED): `initCallKeep('AfroConnect')` called at module level (before any auth). `registerVoipPushNotifications()` called after user authenticates; the received VoIP token is POSTed to `/api/notifications/register-voip-token`.
  - `frontend/index.js` (UPDATED): Registers a `BackgroundCallTask` headless task on Android — triggered by native background FCM data messages to call `displayIncomingCall` and set `global.__pendingVoipCall` before the React tree mounts.
  - `frontend/app.json` (UPDATED): iOS — added `backgroundModes: ['voip','audio','fetch','remote-notification']`, `UIBackgroundModes`, CallKit entitlement. Android — added `MANAGE_OWN_CALLS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_PHONE_CALL`, `CALL_PHONE`, `READ_PHONE_STATE`, `READ_PHONE_NUMBERS`, `BIND_TELECOM_CONNECTION_SERVICE` permissions.
  - `frontend/plugins/withCallKeep.js` (NEW): Expo config plugin that injects `RNCallKeepConnectionService` into AndroidManifest.xml and adds the `android.hardware.telephony` `<uses-feature>`.
  - `backend/utils/voipPush.js` (NEW): Sends APNs VoIP pushes via `node-apn`. Reads `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY`, `APNS_BUNDLE_ID` env vars; logs a warning and skips gracefully if unconfigured.
  - `backend/models/User.js` (UPDATED): Added `voipPushToken` field.
  - `backend/routes/notifications.js` (UPDATED): Added `POST /api/notifications/register-voip-token` endpoint.
  - `backend/server.js` (UPDATED): On `call:initiate`, if target user has a `voipPushToken` the server now sends a VoIP push (wakes killed iOS app → triggers CallKit UI) before the regular Expo push.
  - **Firebase Messaging added**: Installed `@react-native-firebase/app` and `@react-native-firebase/messaging`. `frontend/services/firebaseMessaging.ts` registers a background message handler; `frontend/index.js` calls it before `registerRootComponent`. The FCM token is fetched after login and stored in `backend/models/User.js` `fcmToken` field via `POST /api/notifications/register-fcm-token`. Backend `backend/utils/fcmPush.js` uses Firebase Admin SDK (`firebase-admin`) to send data-only FCM messages for calls.
  - **To enable Android killed-app call ringing via Firebase**: set `FIREBASE_SERVICE_ACCOUNT` env var to the full JSON of your Firebase service account key (Firebase Console → Project Settings → Service Accounts → Generate New Private Key).
  - **To enable iOS VoIP push for killed-app ringing**: set `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY` (contents of your .p8 key), and optionally `APNS_BUNDLE_ID` in environment variables. The app otherwise functions normally via the Expo notification fallback.
- **Admin support and moderation fixes**:
  - `admin-dashboard/App.tsx` and `admin-dashboard/constants.tsx`: Support agents no longer land on the admin-only dashboard or user search; they are routed to "My Tickets" to avoid misleading backend/API errors after successful support login.
  - `backend/models/Report.js`, `backend/routes/reports.js`, and `backend/routes/admin.js`: Content Moderation is now end-to-end wired to real report records with `contentType`, `contentId`, and `contentUrl`. Admins can approve/reject reported profile photos, stories, and chat image messages; reject removes the real source content and resolves the report.
  - `frontend/screens/ProfileDetailScreen.tsx`, `frontend/screens/StoryViewerScreen.tsx`, and `frontend/screens/ChatDetailScreen.tsx`: Mobile reporting now sends exact content references for profile photos, stories, and incoming chat images so they appear in the Content Moderation queue.
- **Verification and appeal flow fixes**:
  - `frontend/screens/VerificationScreen.tsx`: Switched verification submission from selfie photo capture to front-camera video recording. Users must record for at least 5 seconds before reviewing and submitting the video to `/api/verification/upload-verification-video`; recordings stop at a 30-second maximum.
  - `frontend/screens/SettingsScreen.tsx`: Changed the verification row label from "Photo Verification" to "Video Verification" and replaced the rejected status label with "Try Again".
  - `backend/routes/verification.js` and `backend/routes/admin.js`: Added profile cache invalidation after verification uploads, verification decisions, bans, and appeal changes so the mobile app sees fresh status immediately.
  - `backend/routes/admin.js` and `frontend/screens/AppealBannedScreen.tsx`: Reset approved appeals after admin approval and treat old approved appeal records as submit-able when a user is banned again.
- **Face verification liveness flow**:
  - `frontend/screens/VerificationScreen.tsx`: Replaced timer/skip selfie flow with strict sequential steps (`0=blink`, `1=left`, `2=right`, `3=complete`). The camera records automatically, detects blink/head turns with lightweight face detection, and only stops after all steps complete.
  - `backend/routes/verification.js`: Added `POST /upload-verification-video` for multipart video uploads with `userId`, cloud upload when configured, and local server fallback.
  - `backend/models/User.js`: Added `verificationVideoUrl` and `verificationVideo` fields while preserving existing verification status logic; uploaded videos set `verificationStatus` to `pending`.
  - `admin-dashboard/views/IDVerification.tsx`: The review panel now shows the submitted verification video beside the profile photo instead of the old submitted selfie image.
  - `frontend/screens/VerificationScreen.tsx`: Added premium Lottie-powered prompt animation, SVG step icons, and MediaPipe-style landmark gating for centered face, usable landmarks, distance guidance, blink readiness, and opposite-direction head turns.
  - `frontend/package.json`: Added `lottie-react-native` for animated guided verification prompts.
- **Admin Dashboard — full interactivity upgrade**:
  - `UserManagement.tsx`: Removed all mock data. Added server-driven pagination (25/page, prev/next + page buttons), suspend user (with duration selector), delete user (with confirmation modal), CSV export, refresh button, detailed error states, and correct `active` status filter mapping.
  - `ReportsQueue.tsx`: Removed all mock data. Added refresh button, proper error state with retry, inline ban button on each row, toast notifications on resolve/ban actions.
  - `IDVerification.tsx`: Removed all mock data. Added refresh button, editable rejection reason field, proper error/empty states.
  - `ContentModeration.tsx`: Removed all mock data. Error state with retry, clean empty states, no fallback to fake data.
  - All views: No mock/fake data anywhere — backend failure shows error banner with Retry button instead of silently falling back to placeholder rows.
  - Vite config: Removed security headers from dev server (they belong at the reverse-proxy/deployment layer, not dev) so Replit preview iframe works correctly.
  - Workflow: Added `waitForPort: 5000` and `npm install --legacy-peer-deps` step so Replit correctly detects startup.
- **Centralized Support System** — full implementation across all three layers:
  - `backend/models/SupportTicket.js`: Extended model — added `assignedTo`, `unreadByUser`, `unreadByAgent` fields; `pending` status; `agent` role in messages; `senderName`/`senderId` fields.
  - `backend/models/User.js`: Added `isSupportAgent` boolean field for support agent role.
  - `backend/middleware/supportAccess.js`: New middleware — `isAdmin`, `isAgent`, `isAdminOrAgent` guards.
  - `backend/routes/support.js`: Fully rewritten. New endpoints: `POST /ticket`, `GET /user`, `GET /ticket/:id`, `GET /unread`, `POST /reply`, `GET /all`, `PATCH /status`, `PATCH /assign`, `GET /agents`. All legacy routes preserved.
  - `admin-dashboard/services/adminApi.ts`: New methods: `getAllSupportTickets`, `getSupportTicket`, `replySupportUnified`, `updateSupportStatus`, `assignSupportTicket`, `getSupportAgents`.
  - `admin-dashboard/types.ts`: Extended `SupportTicket` type with full fields; added `TicketMessage`, `SupportAgent` interfaces.
  - `admin-dashboard/views/SupportDesk.tsx`: Fully rewritten — real API (no mocks), 15-second polling, assign-to-agent dropdown, all 4 statuses, unread badges, optimistic updates.
  - `admin-dashboard/views/AgentDashboard.tsx`: NEW — agent-only interface showing assigned tickets only, with chat thread and status controls.
  - `admin-dashboard/App.tsx`: Added `agent` tab + `AgentDashboard` import.
  - `admin-dashboard/constants.tsx`: Added "My Tickets" nav item for Support role.
  - `frontend/screens/SupportMessagesScreen.tsx`: Complete rewrite — ticket list with unread badges, create ticket form with category chips, chat thread with polling every 10 s, reply sending with optimistic update.
- **Auth signup fix** (`backend/routes/auth.js`): Removed Joi `validate(schemas.auth.signup)` middleware from the signup route — replaced with inline email/password validation only. Eliminates spurious "name is required" error caused by stale cached Joi schema.
- **Voice bio MIME fix** (`backend/routes/upload.js`): Added `video/mp4` and `video/quicktime` to `ALLOWED_AUDIO_TYPES` (React Native sends m4a files with these MIME types on some Android devices).
- **Voice bio parse fix** (`frontend/screens/EditProfileScreen.tsx`): Changed audio upload MIME type to `audio/mp4`, added content-type check before calling `res.json()` to handle HTML error responses without crashing.
- **Daily match route** (`backend/routes/match.js`): Added null check for `me`, wrapped cache lookup and score calculation in try/catch, reduced candidates limit 100→30, always returns JSON even on error.
- **MyProfileScreen redesign** (`frontend/screens/MyProfileScreen.tsx`): Replaced flat "Profile Details" list and "Personality Prompt" section with organized sections matching EditProfileScreen: Dating Preferences, Personality, Lifestyle, Cultural Identity, Background, Work & Location, Soundtrack, Interests. Each section uses colored icon bubbles matching EditProfile colors.
- **EditProfileScreen fix** (`frontend/screens/EditProfileScreen.tsx`): Removed duplicate `container` and `header` style definitions in StyleSheet.create.
- **Chat (backend)**: `backend/routes/chat.js` — Conversations query now includes `status: 'unmatched'` so old chat histories remain visible.
- **VerificationScreen** (`frontend/screens/VerificationScreen.tsx`): Full layout redesign — gradient hero card, 2×2 benefits grid, numbered steps card.
- **LoveRadarScreen** (`frontend/screens/LoveRadarScreen.tsx`): Added missing gender filter pills.
- **FiltersScreen** (`frontend/screens/FiltersScreen.tsx`): Fixed disabled logic on Verified Only card.
- **ChatsScreen** (`frontend/screens/ChatsScreen.tsx`): Tinder/Bumble-style flat conversation rows.

## Overview
AfroConnect is a dating/social app for the African diaspora. It consists of three independent folders:

## Folder Structure

```
/
├── backend/          ← Node.js + Express API (port 3001)
├── frontend/         ← Expo / React Native mobile app
└── admin-dashboard/  ← React + Vite + Tailwind admin panel (port 5000)
```

## backend/
- **Stack**: Node.js, Express, MongoDB (Mongoose), Socket.io
- **Entry point**: `server.js`
- **Port**: 3001
- **Serves**: REST API + WebSockets
- **Deploy**: Render — root dir `backend`, build cmd `npm install`, start cmd `PORT=3001 node server.js`
- **Env vars needed**:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `EMAIL_USER` / `EMAIL_PASS`
  - `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE`
  - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
  - `PORT=3001`
  - `NODE_ENV=production`

## frontend/
- **Stack**: Expo, React Native, TypeScript
- **Entry point**: `index.js` → `App.tsx`
- **Key config**: `constants/config.ts` — auto-detects backend URL

## admin-dashboard/
- **Stack**: React 18 + Vite + Tailwind CSS + Recharts + Lucide React + TypeScript
- **Entry point**: `index.tsx` → `App.tsx`
- **Port**: 5000 (dev server), proxies `/api` → backend port 3001
- **Build**: `npm run build` (outputs to `dist/`)
- **Features**:
  - JWT Admin Authentication (login + protected routes)
  - Dashboard overview with live stats + charts
  - User Management (table, search, filter, ban/suspend/delete/verify)
  - Reports & Moderation (view reports, warn/ban/ignore)
  - Content Moderation (AI-flagged image review, approve/reject)
  - Analytics (Recharts graphs — user growth, engagement, daily activity)
  - Broadcasts (send push notifications to segmented audiences)
  - ID Verification queue (approve/reject user ID submissions)
  - Payments & Revenue (subscription revenue charts)
  - Settings (app configuration panel)
  - Admin Profile
  - Dark/Light mode toggle
  - Responsive sidebar navigation

## Admin Dashboard — Key Routes (Backend API)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/activity-monitoring` | Live activity |
| GET/PUT | `/api/admin/users` | User management |
| PUT | `/api/admin/users/:id/ban` | Ban/unban user |
| PUT | `/api/admin/users/:id/suspend` | Suspend user |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET/PUT | `/api/admin/reports/:id/resolve` | Reports moderation |
| GET/PUT | `/api/admin/verifications` | ID verification |
| GET/PUT | `/api/admin/flagged-content` | Content moderation |
| GET/POST | `/api/admin/broadcasts` | Push notifications |
| GET/PUT | `/api/admin/settings` | App settings |
| GET | `/api/admin/analytics` | Analytics data |
| GET | `/api/admin/subscriptions-revenue` | Revenue data |

## Local Development
```bash
# Backend (port 3001)
cd backend && PORT=3001 node server.js

# Admin Dashboard (port 5000)
cd admin-dashboard && npm run dev
```

## Security Notes
- `.env` files are gitignored — never commit them
- JWT secret is a 128-char cryptographically random hex string
- All secrets must be added to Render's Environment Variables dashboard for production
- Admin login requires `isAdmin: true` on the user document in MongoDB
