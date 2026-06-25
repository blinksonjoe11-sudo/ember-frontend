# Ember App (React + Capacitor)

Mobile-first frontend for the Ember backend. Verified-adults-only (18+) tobacco
discovery and community app for Lagos, Abuja, Port Harcourt, and Warri.

Built with Vite + React + TypeScript, wired to the Go backend, and ready to wrap
in Capacitor for Android (FCM push, secure token storage, geolocation-ready).

## What's wired up

- **Auth** — register (user or plug), 6-digit email verification, login, bearer
  JWT with automatic refresh on 401.
- **Connect** — search people and plugs in your city; tap to open a DM.
- **Messages** — conversation list, live-updating over WebSocket.
- **Chat** — real-time DMs with optimistic send; moderation-held messages are
  dropped with a notice.
- **Lounge** — your city's default lounge (auto-join + enter). Community
  *creation* is intentionally left out for now — only the default location
  lounge is shown.
- **Profile** — avatar upload (Cloudinary via backend), plug NIN submission and
  verification status, logout.
- **Push** — FCM registration on device; token sent to `/api/devices`.

## Run on web (dev)

```bash
npm install
cp .env.example .env      # point VITE_API_BASE at your backend
npm run dev
```

Open http://localhost:5173. The backend must be running (default :4173).

### .env

```
VITE_API_BASE=http://localhost:4173
VITE_WS_BASE=ws://localhost:4173
```

- **Android emulator** can't see `localhost` — use `http://10.0.2.2:4173` and
  `ws://10.0.2.2:4173`.
- **Real device on your Wi-Fi** — use your PC's LAN IP, e.g.
  `http://192.168.1.20:4173`.

## Wrap in Capacitor (Android)

```bash
npm run build
npx cap add android
npx cap sync
npx cap open android      # opens Android Studio; run from there
```

For push, drop your `google-services.json` into `android/app/` and follow the
Capacitor Push Notifications setup. The app already registers the FCM token
after login and posts it to the backend.

Whenever you change web code: `npm run cap:sync` (builds + copies into android).

## Notes

- Token storage uses `@capacitor/preferences` — works on web (localStorage) and
  device (native), so the same code runs everywhere.
- The WebSocket authenticates via `?token=` because browsers can't set headers
  on the WS handshake; it reconnects with backoff if dropped.
- HTTP (not HTTPS) to a LAN IP is fine for dev. For release builds, serve the
  backend over HTTPS or Android will block cleartext by default.
