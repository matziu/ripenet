# RipeNet - IP Address Management

Web application for managing IP address infrastructure: projects, sites, VLANs, subnets, hosts, DHCP pools, and network tunnels.

## Stack

- **Backend:** Django 5 + Django REST Framework, PostgreSQL 16 (native CIDR/INET types via django-netfields)
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4, TanStack Query, Zustand
- **Infrastructure:** Docker Compose, Redis (caching), Nginx

## Features

- Hierarchical network management: Project > Site > VLAN > Subnet > Host
- DHCP pool management with lease tracking and utilization monitoring
- Network tunnels (GRE, IPsec, VXLAN, WireGuard) with cross-project support
- Interactive topology view (React Flow) with drag-and-drop layout
- Geographic map view (Leaflet) for sites with coordinates
- Subnet calculator and VLSM partitioning tools
- Command palette (Ctrl+K) for quick search across all resources
- PDF/Excel export of network documentation
- Audit log with full change history
- Role-based access: admin / editor / viewer
- Dark mode

## Quick Start

Requirements: Docker and Docker Compose.

```bash
# Clone and start
git clone https://github.com/matziu/ripenet.git
cd ripenet
docker compose -f docker-compose.dev.yml up --build
```

This will:
- Start PostgreSQL 16 + Redis
- Run migrations and create an admin user
- Load sample seed data
- Start the Django dev server on port 8000

Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and log in:

| Field    | Value   |
|----------|---------|
| Username | `admin` |
| Password | `admin` |

## Production

```bash
docker compose up --build -d
```

This runs:
- Backend with Gunicorn behind Nginx
- Frontend as a static build served by Nginx on port 3000
- PostgreSQL and Redis

## Project Structure

```
backend/
  apps/
    accounts/    # User model, auth, admin API
    audit/       # Change tracking
    exports/     # PDF/Excel generation
    ipam/        # VLANs, subnets, hosts, DHCP pools, tunnels
    projects/    # Projects, sites, topology endpoint
    search/      # Global search
  config/        # Django settings, root URLs
frontend/
  src/
    api/         # Axios client, API endpoints
    components/  # UI components, forms, layout
    lib/         # Utilities, topology graph logic
    pages/       # Route pages
    stores/      # Zustand stores (UI, selection, topology)
docker/
  Dockerfile.backend
  Dockerfile.frontend
  nginx.conf
  entrypoint.dev.sh
  init-extensions.sql
```

## API

REST API at `/api/v1/` with endpoints:

- `/projects/`, `/projects/{id}/sites/`, `/projects/{id}/topology/`
- `/vlans/`, `/subnets/`, `/hosts/`, `/dhcp-pools/`, `/tunnels/`
- `/subnets/{id}/next-free-ip/`, `/subnets/{id}/suggested-pool-range/`
- `/tools/subnet-info/`, `/tools/vlsm/`
- `/search/?q=...`
- `/users/` (admin only)

## License

MIT
