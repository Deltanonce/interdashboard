# SENTINEL OMEGA Developer Guide

## Architecture Overview

SENTINEL OMEGA is built on a modular Node.js backend and a 3D CesiumJS frontend. The system is designed for high-concurrency real-time telemetry processing.

### Directory Structure
```
sentinel-omega/
├── asset-tracker/        # Core business logic for tracking
│   ├── adsb-handler.js   # ADS-B aircraft lifecycle
│   ├── ais-handler.js    # AIS maritime lifecycle
│   ├── adsb-validator.js # Sanity and teleportation checks
│   ├── ais-classifier.js # IMO category & threat engine
│   ├── index.js          # Unified tracker entry point
│   └── ...
├── security/             # Hardening & validation
│   ├── input-validator.js
│   ├── rate-limiter.js
│   └── secrets-manager.js
├── scripts/              # CI/CD and automation
├── tests/                # Jest testing suite
├── briefings/            # Persistent Markdown reports
├── logs/                 # Operational logs
├── map.js                # 3D rendering & shader logic
├── server.js             # HTTP/Middleware core
└── index.html            # Command Center UI
```

## Adding a New Data Source

To add a new telemetry source (e.g., Land Assets):

1. **Create Handler:** Add `asset-tracker/land-handler.js` extending the polling/stream logic.
2. **Register in Index:** Import and initialize in `asset-tracker/index.js`.
3. **Map Icon:** Add SVG template to `ASSET_SVG` in `map.js`.
4. **Enrichment:** Add classification logic in a new classifier module.

## UI Customization

The dashboard uses a custom CSS-grid layout defined in `style-spy.css`. 
- **Theming:** Modify `:root` variables for colors and glows.
- **HUD Panels:** Add new divs to the sidebar in `index.html` and use `telem-item` class for styling.

## Performance Tuning

### Memory Management
- The `intelligenceBuffer` in `server.js` is limited to 50 telemetry points per asset.
- `AssetTracker` evicts assets unseen for >5 minutes.

### Rendering
- Offload complex math to the `prediction-engine.js`.
- Use `Cesium.PostProcessStage` for global shaders instead of heavy CSS filters on the canvas.

## Testing Strategy

- **Unit Tests:** Located in `tests/unit`. Focus on pure functions (math, parsing).
- **Integration Tests:** Located in `tests/integration`. Focus on the data pipeline.
- **Manual Verification:** Use `npm run validate` to check configuration before launch.
