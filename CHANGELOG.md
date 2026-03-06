# Changelog

## [4.2.0] - 2026-03-06

### Changed
- Performance: Implemented DOM element caching for high-frequency UI updates.
  - Clock, throughput, countdown, and loading-overlay flows now use cached lookups.
  - AIS status indicators and live telemetry counters now use cached lookups.
  - Added `dom-cache.js` with safe fallback re-query behavior for disconnected nodes.
  - Estimated DOM query reduction in hot paths from repeated per-tick queries to cached access.

### Fixed
- Merge-conflict follow-up: retained cached `getEl()` accessors in hot paths instead of reverting to uncached `document.getElementById()` calls.

## [4.1.0] - 2026-03-06

### Fixed
- Critical: Asset tracker now waits for map bridge readiness before start, preventing lost live marker updates at boot.
- Critical: Node AIS relay now supports runtime WebSocket resolution and proper Node `ws` event handling.
- Memory: Reduced live tracking footprint with shorter trails and bounded live asset retention.

### Changed
- Trail history reduced from 200 to 50 points.
- Live asset set capped at 200 with oldest-first eviction.
- Stale cleanup cadence changed from 60s to 30s.
- PowerShell proxy now uses relative static-file paths (`$PSScriptRoot`) and runs AIS endpoint in HTTP-only informational mode.
- Added AIS key status indicator in LIVE FEEDS panel (`CONFIGURED`/`NOT SET`/`ERROR`).
