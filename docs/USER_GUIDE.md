# SENTINEL OMEGA User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard Interface](#dashboard-interface)
3. [Asset Tracking](#asset-tracking)
4. [Daily Briefings](#daily-briefings)
5. [Telegram Alerts](#telegram-alerts)
6. [Troubleshooting](#troubleshooting)

## Getting Started

### First Launch

1. **Start the Server**
   ```bash
   npm start
   ```

2. **Open Dashboard**
   - Navigate to http://localhost:8888
   - Wait for Cesium to load (5-10 seconds)

3. **Verify Data Feeds**
   - Check "SYSTEM MONITOR" panel
   - Ensure ADS-B and AIS show "up" status

---

## Dashboard Interface

### 3D Globe Controls
- **Rotate:** Left-click + drag
- **Zoom:** Scroll wheel or pinch
- **Pan:** Right-click + drag
- **Tilt:** Middle-click + drag

### Asset Markers
| Color | Type | Meaning |
|-------|------|---------|
| 🔴 Red | Aircraft | High-value military asset |
| 🟡 Yellow | Aircraft | Standard military aircraft |
| 🔵 Blue | Vessel | Naval vessel |
| 🟢 Green | Satellite | Active satellite |

### Information Panels
1. **Priority Assets**
   - Real-time list of high-value targets
   - Click asset to focus camera
2. **Strategic Briefing**
   - Latest intelligence synthesis
   - Auto-generated every 24 hours
3. **System Monitor**
   - Health status
   - Active asset count
   - Error rates

---

## Asset Tracking

### Viewing Asset Details
- Click on marker in 3D globe
- View popup with details:
  - Callsign / Hex Code
  - Position (lat/lon/alt)
  - Speed / Heading
  - Confidence Score

### Predictive Paths
Yellow dashed lines show predicted position 15 minutes ahead.
- **Solid portion:** High confidence
- **Dashed portion:** Decreasing confidence
- **End marker:** Predicted final position

### Filtering Assets
Use category toggles:
- ☑️ Military Aircraft
- ☑️ Maritime Vessels
- ☐ Satellites
- ☐ Commercial Aircraft

---

## Daily Briefings

### Accessing Briefings
- Navigate to `/api/briefings-list`
- View list of generated reports
- Use `/api/briefing/download/:filename` to view

### Briefing Structure
```markdown
# STRATEGIC BRIEFING - [DATE]

## Executive Summary
[Threat level, key highlights]

## Priority Assets Detected
[Top 10 targets with details]

## ADIZ Incursions
[Boundary violations]

## Threat Assessment
[Overall analysis]

## Recommended Actions
[Strategic recommendations]
```

### Manual Generation
```bash
curl -X POST http://localhost:8888/api/generate-briefing
```

---

## Telegram Alerts

### Setup
1. **Create Bot:**
   - Message @BotFather on Telegram
   - Send `/newbot`
   - Save bot token
2. **Get Chat ID:**
   - Message @userinfobot
   - Copy your chat ID
3. **Configure:**
   ```bash
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_CHAT_ID=your_chat_id
   ENABLE_TELEGRAM=true
   ```

### Alert Types
1. **Priority Target Detected**
   ```
   🚨 SENTINEL ALERT
   Target: KC-135
   Position: [coordinates]
   Time: [timestamp]
   ```
2. **ADIZ Incursion**
   ```
   ⚠️ ADIZ INCURSION
   Zone: Indonesia ADIZ
   Target: [callsign]
   ```
3. **Daily Briefing**
   ```
   📊 DAILY BRIEFING READY
   Date: [date]
   Threat Level: MODERATE
   ```

---

## Troubleshooting

### No Assets Appearing
- **ADS-B API:** Visit https://api.adsb.lol/v2/mil (should return JSON).
- **AIS WebSocket:** Check console for connection errors; verify API key.
- **Network:** Ping api.adsb.lol; check firewall settings.

### Slow Performance
- **Reduce trail points:** `MAX_TRAIL_POINTS=25` in `.env`
- **Lower asset limit:** `MAX_LIVE_ASSETS=100` in `.env`
- **Disable satellites:** `ENABLE_SATELLITES=false` in `.env`

### Telegram Not Sending
- Verify token and chat ID.
- Check bot permissions.
- Ensure `ENABLE_TELEGRAM=true` in `.env`.

### Health Check Failing
```bash
# Check status
curl http://localhost:8888/api/health

# View detailed metrics
curl http://localhost:8888/api/metrics
```
