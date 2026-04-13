# AfroConnect — Project Structure

## Recent Changes
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
