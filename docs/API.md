# SENTINEL OMEGA API Documentation

## System Endpoints

### `GET /api/health`
Checks the overall health of the system and its sub-services.
- **Response:** `200 OK` (Healthy) or `503 Service Unavailable` (Degraded)
- **Fields:** `status`, `uptime`, `services` (adsb, ais status).

### `GET /api/metrics`
Exposes real-time performance and operational metrics.
- **Fields:** `requests`, `adsb` (poll stats), `ais` (msg count), `performance` (RPM).

### `GET /api/info`
Returns process-level information and server environment.

---

## Intelligence Endpoints

### `GET /api/adsb-mil`
Relay for filtered military aircraft telemetry.
- **Source:** api.adsb.lol
- **Filter:** Bounding box + IsMilitary flag.

### `GET /api/ais-poll`
Retrieves the latest batch of maritime messages from the relay.

### `GET /api/briefings-list`
Returns a list of all historically generated strategic reports.

### `GET /api/briefing/download/:filename`
Downloads a specific briefing in Markdown format.

### `POST /api/generate-briefing`
Manually triggers the daily strategic synthesis engine.

### `GET /api/generate-report`
Synthesizes the RAM-only Intelligence Buffer into a situation summary.

---

## Administrative Endpoints

### `POST /api/admin/rotate-keys`
Rotates the administrative API key.
- **Header:** `x-api-key` required.

### `POST /api/validate-target`
Sanitizes and validates a single asset telemetry object.
- **Body:** JSON object with `lat`, `lon`, `altitude`, etc.
