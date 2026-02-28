# Port Template Serialization & Auto-Apply — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable bulk port template creation via pattern serialization (e.g., `ether{N}` → ether1...ether24) and auto-apply templates to hosts.

**Architecture:** Hybrid approach — frontend generates port names from pattern for live preview, sends bulk list to a new backend endpoint. Auto-apply on host creation via existing `post_save` signal (already works). Re-apply button on existing hosts with confirmation dialog.

**Tech Stack:** Django 5 + DRF (backend), React 18 + TypeScript + TanStack Query (frontend)

---

## Existing Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| DeviceType model | ✅ Done | `backend/apps/ipam/models/device_type.py` |
| PortTemplate model | ✅ Done | `backend/apps/ipam/models/port_template.py` |
| PortTemplate CRUD API | ✅ Done | `backend/apps/ipam/views.py:266-296` |
| Apply to existing hosts | ✅ Done | `POST /device-types/{id}/port-templates/apply/` |
| Auto-apply on host create | ✅ Done | `backend/apps/ipam/signals.py:8-21` (post_save) |
| Settings UI (DeviceTypes + PortTemplates) | ✅ Done | `frontend/src/pages/SettingsPage.tsx:556-697` |
| Frontend API client | ✅ Done | `frontend/src/api/endpoints.ts:146-158` |

## What's New

### 1. Serialization Generator (Frontend — SettingsPage)

Inline panel in PortTemplatesPanel, toggled by "Generate series" button.

```
┌─────────────────────────────────────────────────────┐
│ Generate Port Series                                │
│                                                     │
│ Pattern: [ether{N}     ]  Type: [rj45 ▾]           │
│ Start:   [1  ]  End: [24 ]  Step: [1 ]              │
│                                                     │
│ Preview:                                            │
│ ether1, ether2, ether3, ether4, ... ether24         │
│                                        (24 ports)   │
│                                                     │
│              [Cancel]  [Add 24 ports]               │
└─────────────────────────────────────────────────────┘
```

**Pattern syntax:**
- `{N}` — number without padding (1, 2, 10, 100)
- `{NN}` — 2-digit zero-padded (01, 02, 10)
- `{NNN}` — 3-digit zero-padded (001, 002, 100)

**Validation:**
- Pattern must contain exactly one `{N+}` placeholder
- Start ≤ End
- Step ≥ 1
- Result count ≤ 200

**Examples:**
- `ether{N}`, start=1, end=24, step=1 → ether1...ether24
- `SFP+{N}`, start=1, end=4, step=1 → SFP+1...SFP+4
- `GE0/0/{NN}`, start=0, end=47, step=1 → GE0/0/00...GE0/0/47

### 2. Bulk Create Endpoint (Backend)

```
POST /api/device-types/{id}/port-templates/bulk-create/
```

**Request body:**
```json
{
  "templates": [
    {"name": "ether1", "port_type": "rj45"},
    {"name": "ether2", "port_type": "rj45"},
    ...
  ]
}
```

Position is auto-assigned: max existing position + 1, incrementing.

**Response:** `201` with list of created templates.

**Validation:**
- No duplicate names within request
- No duplicate names with existing templates for this device type
- Max 200 templates per request
- Each name must be non-empty

**Error:** `400` with details on which names conflict.

### 3. Re-Apply Template on Existing Host (Backend + Frontend)

**New endpoint:**
```
POST /api/hosts/{id}/apply-port-template/
```

Applies port templates matching host's `device_type`. Creates missing ports (get_or_create). Does NOT delete or modify existing ports.

**Response:**
```json
{"detail": "Created 5 port(s) from template.", "created": 5}
```

**Frontend (HostPortsSection in DetailPanel.tsx):**
- Button: `⚡ Sync from template` next to `+ Port`
- On click → confirmation dialog: "Sync ports from device type template? Missing ports will be added. Existing ports won't be changed or deleted."
- On confirm → POST → toast with result
- Button only visible when host has a device_type that has port templates

### 4. Frontend API additions

```typescript
// In portTemplatesApi:
bulkCreate: (deviceTypeId: number, templates: Array<{name: string, port_type: string}>) =>
  apiClient.post(`/device-types/${deviceTypeId}/port-templates/bulk-create/`, { templates }),

// In hostsApi:
applyPortTemplate: (hostId: number) =>
  apiClient.post<{detail: string, created: number}>(`/hosts/${hostId}/apply-port-template/`),
```

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/apps/ipam/views.py` | Add `bulk_create` action to PortTemplateViewSet, add `apply_port_template` action to HostViewSet |
| `backend/apps/ipam/urls.py` | Add URL pattern for bulk-create and apply-port-template |
| `frontend/src/api/endpoints.ts` | Add `bulkCreate` and `applyPortTemplate` methods |
| `frontend/src/pages/SettingsPage.tsx` | Add SeriesGenerator inline panel to PortTemplatesPanel |
| `frontend/src/components/layout/DetailPanel.tsx` | Add "Sync from template" button to HostPortsSection |
