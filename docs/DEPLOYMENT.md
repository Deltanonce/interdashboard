# SENTINEL OMEGA Deployment Guide

## Deployment Checklist

### 1. Prerequisites
- [ ] Node.js 18+ installed
- [ ] Valid Cesium Ion Token (for 3D buildings)
- [ ] Valid AISStream API Key
- [ ] Telegram Bot Token (optional)

### 2. Environment Configuration
- [ ] `cp .env.example .env`
- [ ] Set `NODE_ENV=production`
- [ ] Set `PORT=8888`
- [ ] Set `HOST=0.0.0.0`
- [ ] Configure all API keys

### 3. Verification
- [ ] Run `npm install`
- [ ] Run `npm run validate`
- [ ] Run `npm test`

---

## Deployment Options

### Docker (Recommended)
```bash
# Build and start the stack
docker-compose up -d --build

# Verify health
curl http://localhost:8888/api/health
```

### Manual VPS (PM2)
```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server.js --name sentinel-omega

# Save configuration
pm2 save
pm2 startup
```

## Maintenance

### Log Rotation
The Docker configuration includes built-in log rotation (10MB max size, 3 files). For manual deployments, use `pm2-logrotate`.

### Briefing Archiving
The `./briefings` directory stores Markdown files. It is recommended to back these up weekly if historical persistence is required.

### Key Rotation
Administrative keys can be rotated via `POST /api/admin/rotate-keys`. 
Update the `AISSTREAM_API_KEY` in `.env` every 90 days as per security policy.
