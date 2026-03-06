# Intel Dashboard

Real-time strategic dashboard with live ADS-B military aircraft and AIS maritime overlays.

## Run

### Node server (recommended)

```bash
npm install
npm start
```

Server starts on `http://localhost:8888` and provides:
- `GET /api/adsb-mil`
- `GET /api/ais-poll`

## AIS Live Vessel Tracking

AIS can run in two modes:

- **Browser direct WebSocket**: dashboard connects directly to AIS stream when a valid key is configured.
- **Node relay**: `server.js` relays AIS via WebSocket and serves it through `/api/ais-poll`.

### Setup

1. Get API key from https://aisstream.io/
2. Configure key in browser config (where `window.AISSTREAM_API_KEY` is defined).
3. For Node relay mode, set env var:

```bash
export AISSTREAM_API_KEY='your-key-here'
```

4. Ensure `ws` dependency is installed (`npm install`).

### Server mode notes

- **Node (`server.js`)**:
  - Uses global `WebSocket` if available, else `ws` package.
  - If WebSocket runtime is unavailable, relay is disabled with a clear warning.
- **PowerShell (`proxy-server.ps1`)**:
  - Runs in **HTTP-only mode**.
  - Does **not** provide server-side AIS WebSocket relay.
  - `/api/ais-poll` returns an informational error payload in this mode.
