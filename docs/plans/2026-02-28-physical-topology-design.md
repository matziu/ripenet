# Physical Topology (L1) — Cables, Ports & Patch Panels

## Goal

Full Layer 1 physical topology documentation: device ports, cables, patch panels.
Engineers can see what is physically connected to what, with which cable, across the entire infrastructure.

## Design Decisions

- **Approach A**: PatchPanel as a separate model (not a Host). Clean L1/L3 separation.
- **Port templates**: defined on DeviceType, auto-created on Host/PatchPanel creation.
- **Template sync**: changes can be applied to existing hosts with confirmation (adds missing ports, never removes connected ones).
- **Cables**: connect any two DevicePorts. No site restriction — fiber/cross-site cables allowed.
- **Visualization**: new "physical" view mode (React Flow), scoped per-Site.
- **Settings**: refactored to sidebar navigation layout (General / Device Types / Users / Backup).

---

## Data Model

### PortTemplate (new)

Defines what ports a device type has. Lives on DeviceType.

| Field     | Type                | Notes                                    |
|-----------|---------------------|------------------------------------------|
| device_type | FK → DeviceType   | Which device type this template belongs to |
| name      | CharField(100)      | "GE0/0/1", "eth0", "Port 1"             |
| port_type | CharField(30)       | "rj45", "sfp", "sfp+", "qsfp28", "console" |
| position  | PositiveIntegerField | Display/sort order                       |

### DevicePort (new)

Concrete port on a specific device. Auto-created from PortTemplate.

| Field       | Type                  | Notes                              |
|-------------|-----------------------|------------------------------------|
| host        | FK → Host, nullable   | Exactly one of host/patch_panel    |
| patch_panel | FK → PatchPanel, nullable | Exactly one of host/patch_panel |
| name        | CharField(100)        | Copied from template, editable     |
| port_type   | CharField(30)         | Copied from template, editable     |
| position    | PositiveIntegerField  | Sort order                         |
| description | TextField, blank      |                                    |

Constraint: exactly one of `host` or `patch_panel` must be set (CheckConstraint).
Each port can have at most one cable (enforced by OneToOne-like unique on Cable).

### PatchPanel (new)

Physical infrastructure device in a Site. No IP address, no subnet.

| Field       | Type                  | Notes                           |
|-------------|-----------------------|---------------------------------|
| site        | FK → Site             | Physical location               |
| name        | CharField(100)        | "PP-1 Rack A"                   |
| port_count  | PositiveIntegerField  | Number of ports to auto-create  |
| description | TextField, blank      |                                 |

On creation: auto-creates `port_count` DevicePorts named "Port 1", "Port 2"... with port_type="rj45".

### Cable (new)

Physical connection between two ports.

| Field      | Type              | Notes                                    |
|------------|-------------------|------------------------------------------|
| port_a     | FK → DevicePort, unique | Each port can have max 1 cable      |
| port_b     | FK → DevicePort, unique | Each port can have max 1 cable      |
| cable_type | CharField(30)     | "cat5e", "cat6", "cat6a", "fiber_sm", "fiber_mm", "dac", "other" |
| label      | CharField(100), blank | Physical label: "K-142", "Rack A→B #3" |

Validation: `port_a != port_b`. No site restriction (cross-site cables allowed).

---

## API Endpoints

```
# Port Templates (nested under device-types)
GET/POST   /api/v1/device-types/{id}/port-templates/
PATCH/DEL  /api/v1/device-types/{id}/port-templates/{id}/
POST       /api/v1/device-types/{id}/port-templates/apply/   ← sync to existing hosts

# Device Ports
GET        /api/v1/ports/?host={id}&patch_panel={id}&site={id}
PATCH      /api/v1/ports/{id}/                                ← edit name/description
POST       /api/v1/ports/                                     ← manual add
DELETE     /api/v1/ports/{id}/                                ← blocked if cable connected

# Patch Panels
GET/POST   /api/v1/patch-panels/?site={id}
PATCH/DEL  /api/v1/patch-panels/{id}/                         ← delete blocked if cables exist

# Cables
GET/POST   /api/v1/cables/?site={id}
PATCH/DEL  /api/v1/cables/{id}/

# Physical topology (read-only, aggregated)
GET        /api/v1/sites/{id}/physical-topology/
```

### Permissions
- List/retrieve: IsAuthenticated
- Write port templates: IsAdmin (like DeviceType)
- Write ports/cables/patch-panels: ProjectPermission (editor+)

---

## Frontend — Physical View (L1)

New view mode alongside topology/geo/table: **"physical"**.

### Scope
Per-Site. User selects a site in sidebar, view shows all devices and cables in that site.

### React Flow Nodes
- **HostNode** — card with hostname/IP, ports listed along right edge (each port = connection handle)
- **PatchPanelNode** — card with name, ports on both edges (front/back)
- **RemoteNode** — ghost/dimmed node for device in another Site (cross-site cable), click navigates to that site

### React Flow Edges
- **CableEdge** — line connecting two port handles, colored by cable type:
  - Yellow = fiber SM
  - Orange = fiber MM
  - Blue = cat6/cat6a
  - Gray = cat5e
  - Green = DAC
  - White = other
- Label shows cable identifier

### Interactions
- Click port → DetailPanel with port info + connected cable
- Click cable edge → DetailPanel with cable data (type, label, both endpoints)
- Drag between two free ports → create cable dialog (type + label)
- Toolbar buttons → add host, add patch panel
- Layout: dagre (top-down), positions saved in localStorage

### Toolbar
- Filter by device type (show only switches, etc.)
- Toggle: show/hide free ports (ports without cables)
- Cable color legend

---

## Frontend — DetailPanel Extensions

### HostDetail (extended)
New "Ports" section below existing host data:
- Table: port name | type | connected cable or "Free"
- Click port row → expand cable info + remote endpoint
- "Add Port" button for manual ports beyond template

### PatchPanelDetail (new)
- Name, site, description
- Port list with cable connections (same as HostDetail ports)
- Edit / Delete actions

### CableDetail (new)
- Cable type, label
- Port A → device:port_name (clickable → navigate)
- Port B → device:port_name (clickable → navigate)
- Edit / Delete actions

---

## Frontend — Settings Refactor

Settings page restructured with sidebar navigation:

```
┌──────────────┬─────────────────────────────────┐
│              │                                 │
│  General     │  [active section content]       │
│  Device Types│                                 │
│  Users       │                                 │
│  Backup      │                                 │
│              │                                 │
└──────────────┴─────────────────────────────────┘
```

Routing: `/settings/general`, `/settings/device-types`, `/settings/users`, `/settings/backup`.

### Device Types section (extended)
Below each device type row → expandable "Port Templates" subsection:
- Table: name | port_type (dropdown) | actions (edit/delete)
- Add template form at bottom
- "Apply to existing hosts" button when templates change

---

## Frontend — Sidebar Extension

Under each Site in sidebar tree:
- Existing: VLANs, Subnets
- New: **Patch Panels** expandable section with list

---

## Export & Backup

- **Backup JSON**: PortTemplate, DevicePort, PatchPanel, Cable included automatically (app `ipam`)
- **PDF/Excel export**: new "Physical Connections" section — table of cables per site: Port A (device:port) → Port B (device:port), type, label
- **Physical topology API**: `/sites/{id}/physical-topology/` returns full structure for L1 view rendering
