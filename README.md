# RipeNet - IP Address Management

Web application for managing IP address infrastructure: projects, sites, VLANs, subnets, hosts, DHCP pools, and network tunnels.

## Stack

- **Backend:** Django 5 + Django REST Framework, PostgreSQL 16 (native CIDR/INET types via django-netfields)
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS 4, TanStack Query, Zustand
- **Infrastructure:** Docker Compose, Redis (caching)

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

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard-light.png)

### Table view
![Table view](docs/screenshots/table-view-light.png)

### Topology view
![Topology view](docs/screenshots/topology-light.png)

### Detail panel (dark mode)
![Detail panel dark](docs/screenshots/detail-panel-dark.png)

### Table view (dark mode)
![Table view dark](docs/screenshots/table-view-dark.png)

### Topology view (dark mode)
![Topology view dark](docs/screenshots/topology-dark.png)

## Quick Start

The only requirement is [Docker](https://docs.docker.com/get-docker/) (includes Docker Compose).

```bash
git clone https://github.com/matziu/ripenet.git
cd ripenet
docker compose up --build
```

That's it. This starts PostgreSQL, Redis, Django backend, and the Vite frontend. On first run it will download Docker images (~1 min), run database migrations, create an admin user, and load sample network data.

Wait until you see `Local: http://localhost:3000` in the output, then open **http://localhost:3000** and log in:

| Field    | Value   |
|----------|---------|
| Username | `admin` |
| Password | `admin` |

### Stopping

Press `Ctrl+C`, then:

```bash
docker compose down
```

### Starting again

```bash
docker compose up
```

### Custom configuration (optional)

To change database credentials or admin password, copy the example file and edit it:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `ripenet` |
| `POSTGRES_USER` | Database user | `ripenet` |
| `POSTGRES_PASSWORD` | Database password | `ripenet` |
| `DJANGO_SECRET_KEY` | Django secret key | auto-generated |
| `DJANGO_ADMIN_PASSWORD` | Initial admin password | `admin` |

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
    templates/   # Project templates
  config/        # Django settings, root URLs
frontend/
  src/
    api/         # Axios client, API endpoints
    components/  # UI components, forms, layout
    hooks/       # React Query hooks
    lib/         # Utilities, topology graph logic
    pages/       # Route pages
    stores/      # Zustand stores (UI, selection, topology)
    types/       # TypeScript interfaces
docker/
  Dockerfile.backend
  entrypoint.sh
  init-extensions.sql
```

## API

REST API at `/api/v1/`:

| Endpoint | Description |
|----------|-------------|
| `/auth/login/`, `/auth/logout/`, `/auth/me/` | Authentication |
| `/projects/` | Projects CRUD |
| `/projects/{id}/sites/` | Sites per project |
| `/projects/{id}/topology/` | Project topology tree |
| `/vlans/`, `/subnets/`, `/hosts/` | Network resources CRUD |
| `/dhcp-pools/`, `/tunnels/` | DHCP pools and tunnels CRUD |
| `/subnets/{id}/next-free-ip/` | Next available IP in subnet |
| `/subnets/{id}/suggested-pool-range/` | Suggested DHCP pool range |
| `/tools/subnet-info/`, `/tools/vlsm/` | Subnet calculator, VLSM tool |
| `/search/?q=...` | Global search |
| `/audit/` | Change log |
| `/exports/project/{id}/pdf/` | PDF export |
| `/exports/project/{id}/excel/` | Excel export |
| `/users/` | User management (admin only) |

## License

MIT
