# Changelog

All notable changes to this project will be documented in this file.

## [1.1.1] - 2026-02-28

### Added
- Resizable detail panel — drag left edge to resize, width persisted in localStorage

### Fixed
- Detail panel not scrolling when content exceeds panel height
- Dark mode scrollbar now styled consistently across all browsers (webkit + Firefox)

---

## [1.1.0] - 2026-02-28

### Added
- Configurable device types — managed from Settings page instead of hardcoded list
- Device Types CRUD API (`/api/v1/device-types/`) with admin-only write access
- Device type labels displayed throughout the UI (detail panel, table view, host form)
- Dark mode scrollbar styling for sidebar and all panels

### Changed
- Host `device_type` field is now a free CharField validated against the DeviceType table
- Host form dropdown dynamically loads device types from the database
- Device type filter changed from ChoiceFilter to CharFilter

### Migration notes
- Run `docker compose up --build` — migration `0008` creates the `DeviceType` table and seeds 11 default types
- Existing hosts are unaffected (their `device_type` values match the seeded defaults)

---

## [1.0.1] - 2026-02-28

### Added
- Data backup & restore in Settings page (JSON export/import, admin only)
- Detailed backup contents description in Settings UI
- User management panel (CRUD for admin users)

### Fixed
- Sidebar not scrolling when content exceeds screen height
- Backup import returning 415 error (Content-Type fix for FormData uploads)
- Backend port (8000) no longer exposed to host — communicates via internal Docker network only

### Changed
- Simplified README Quick Start to 3 commands (no `.env` required)
- Unified docker-compose into single file (removed separate dev/prod split)
- API documentation in README presented as table for better readability

### Removed
- `docker-compose.dev.yml` (merged into `docker-compose.yml`)
- `docker/Dockerfile.frontend` and `docker/nginx.conf` (unused)
- `backend/.env.example` (redundant — root `.env.example` is sufficient)

## [1.0.0] - 2026-02-18

Initial release.

### Features
- Hierarchical network management: Project > Site > VLAN > Subnet > Host
- DHCP pool management with lease tracking and utilization monitoring
- Network tunnels (GRE, IPsec, VXLAN, WireGuard) with cross-project support
- Interactive topology view (React Flow) with drag-and-drop layout
- Geographic map view (Leaflet) for sites with coordinates
- Table view with hierarchical tree structure
- Subnet calculator and VLSM partitioning tools
- Command palette (Ctrl+K) for quick search across all resources
- PDF/Excel export of network documentation
- Audit log with full change history
- Role-based access control: admin / editor / viewer
- Dark mode
- Resizable sidebar with touch support
- Docker Compose one-command deployment

## Upgrading

### From 1.0.x to 1.1.0

```bash
docker compose down
git pull origin main
docker compose up --build
```

Database migration runs automatically on startup — creates the `DeviceType` table and seeds default types.

### From 1.0.0 to 1.0.1

```bash
docker compose down
git pull origin main
docker compose up --build
```

No database migrations required.

> **Note:** If you previously used `docker compose -f docker-compose.dev.yml`, switch to just `docker compose` — the dev file has been removed.
