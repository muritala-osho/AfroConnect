# AfroConnect — Project Structure

## Recent Changes
- **Chat (backend)**: `backend/routes/chat.js` — Conversations query now includes `status: 'unmatched'` so old chat histories remain visible (previously only `status: 'active'` matches were returned, hiding any conversations where someone unmatched).
- **VerificationScreen** (`frontend/screens/VerificationScreen.tsx`): Full layout redesign — gradient hero card, 2×2 benefits grid, numbered steps card, improved camera selfie UI with corner bracket face guide overlay.
- **LoveRadarScreen** (`frontend/screens/LoveRadarScreen.tsx`): Added missing gender filter pills (Everyone / Women / Men) to the filter panel. Gender was in state but had no UI.
- **FiltersScreen** (`frontend/screens/FiltersScreen.tsx`): Fixed `disabled={!!isPremium}` on the Verified Only card (was blocking Switch interaction on Android for premium users). Non-premium users still see the lock badge and are redirected to Premium on tap.
- **ChatsScreen** (`frontend/screens/ChatsScreen.tsx`): Tinder/Bumble-style flat conversation rows — 60px avatars, subtle bottom-border dividers instead of individual cards, unread timestamp coloured in theme primary.

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
