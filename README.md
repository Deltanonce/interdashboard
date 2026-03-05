# Interdashboard

## Local development

1. Set AIS credentials via environment variable (never in frontend files):
   ```bash
   export AISSTREAM_API_KEY="your_aisstream_key"
   node server.js
   ```
2. Open `http://localhost:8888`.

## Security notes

- `AISSTREAM_API_KEY` is read only by `server.js`.
- Frontend code must use backend relay endpoints (`/api/ais-poll` and optional `/api/ais-status`) and never embed AIS secrets.
- Keep local secret files (`.env*`, `*.env.local`, `secrets.*`) untracked per `.gitignore`.
