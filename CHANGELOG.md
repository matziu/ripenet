# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-02-28

### Fixed
- Sidebar not scrolling when content exceeds screen height
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

### From 1.0.0 to 1.0.1

1. Stop the app:
   ```bash
   docker compose down
   ```

2. Pull latest changes:
   ```bash
   git pull origin main
   ```

3. Start the app (rebuild to apply changes):
   ```bash
   docker compose up --build
   ```

No database migrations required. No configuration changes needed.

> **Note:** If you previously used `docker compose -f docker-compose.dev.yml`, switch to just `docker compose` — the dev file has been removed and everything is now in `docker-compose.yml`.
