# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities to: otriantoko@gmail.com

**Do NOT** open public issues for security vulnerabilities.

## Security Features

### Input Validation
- All telemetry data is validated against physical flight/vessel envelopes.
- Coordinate range checks (-90 to 90 lat, -180 to 180 lon).
- Hex code format enforcement (ICAO 24-bit).
- String sanitization to prevent XSS and injection.

### Rate Limiting
- API endpoints: 150 requests / 15 minutes.
- Automatic IP-based throttling.
- Security headers (helmet.js) integrated into the core HTTP stack.

### Authentication
- API key-based authentication for administrative endpoints.
- Key rotation capability via SecretsManager.
- Audit logging for API key usage.

### Network Security
- Content Security Policy (CSP) enforced via Helmet.
- CORS properly configured for strategic domains.
- HSTS enabled for production environments.

### Data Protection
- OMEGA Protocol: High-value target tracking resides only in volatile RAM.
- Zero-footprint briefing generation.
- Secrets stored with secure OS-level permissions (600).

## Best Practices

### API Keys
1. Never commit `.env` or `.secrets.json` to version control.
2. Use strong, randomly generated keys via `SecretsManager.generateAPIKey()`.
3. Rotate keys regularly.

### Deployment
1. Set `NODE_ENV=production`.
2. Ensure proper file permissions for the application directory.
3. Monitor the `/api/health` and `/api/metrics` endpoints for anomalies.
