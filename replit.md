# AfroConnect — Project Structure

## Overview
AfroConnect is a dating/social app for the African diaspora. It consists of three independent folders:

## Folder Structure

```
/
├── backend/          ← Node.js + Express API (deploy to Render)
├── frontend/         ← Expo / React Native mobile app
└── admin-dashboard/  ← Static HTML/JS admin panel (served by backend)
```

## backend/
- **Stack**: Node.js, Express, MongoDB (Mongoose), Socket.io
- **Entry point**: `server.js`
- **Port**: 3001
- **Serves**: REST API + WebSockets + admin-dashboard as static files at `/admin-web`
- **Deploy**: Render — root dir `backend`, build cmd `npm install`, start cmd `node server.js`
- **Env vars needed on Render**:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `EMAIL_USER` / `EMAIL_PASS`
  - `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE`
  - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
  - `PORT` (Render sets this automatically)
  - `NODE_ENV=production`

## frontend/
- **Stack**: Expo, React Native, TypeScript
- **Entry point**: `index.js` → `App.tsx`
- **Key config**: `constants/config.ts` — auto-detects backend URL
- **Env vars** (in `frontend/.env`):
  - `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`
  - `EXPO_PUBLIC_API_URL`

## admin-dashboard/
- **Stack**: Plain HTML + CSS + JS (vanilla, no build step needed)
- **Served by**: backend at `/admin-web` route
- **No separate deployment needed** — bundled with backend on Render

## Local Development
Run backend: `cd backend && node server.js`
Run frontend: `cd frontend && npx expo start`

## Security Notes
- `.env` files are gitignored — never commit them
- JWT secret is a 128-char cryptographically random hex string
- All secrets must be added to Render's Environment Variables dashboard for production
