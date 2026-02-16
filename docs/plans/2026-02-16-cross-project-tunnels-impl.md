# Cross-Project & External Tunnels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow tunnels to connect sites across projects or to external endpoints outside the system.

**Architecture:** Extend the existing Tunnel model with nullable `site_b` and new `external_endpoint` field. Topology endpoint gathers tunnels from both owning project and cross-project references. Frontend form adds two mutually-exclusive checkboxes to switch between internal/cross-project/external modes.

**Tech Stack:** Django 5, DRF, PostgreSQL, django-postgresql-netfields, React 18, TypeScript, TanStack Query, React Flow, Leaflet

**Design doc:** `docs/plans/2026-02-16-cross-project-tunnels-design.md`

---

### Task 1: Model migration — nullable site_b + external_endpoint

**Files:**
- Modify: `backend/apps/ipam/models/tunnel.py:20-21`
- Modify: `backend/apps/ipam/models/tunnel.py:33-34` (__str__)
- Create: migration via `python manage.py makemigrations ipam`

**Step 1: Update Tunnel model**

In `backend/apps/ipam/models/tunnel.py`, change:

```python
# line 20: make site_b nullable
site_b = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="tunnels_as_b", null=True, blank=True)
# line 21: keep ip_b as-is

# After line 23 (description), add:
external_endpoint = models.CharField(max_length=300, blank=True, default="", help_text="External endpoint name/IP (when site_b is null)")
```

**Step 2: Fix __str__ for nullable site_b**

```python
def __str__(self):
    other = self.site_b.name if self.site_b else self.external_endpoint or "External"
    return f"{self.name} ({self.site_a.name} <-> {other})"
```

**Step 3: Create and run migration**

Run: `cd /srv/ripe-net/backend && python manage.py makemigrations ipam -n cross_project_tunnels`
Run: `python manage.py migrate`

**Step 4: Commit**

```
git add backend/apps/ipam/models/tunnel.py backend/apps/ipam/migrations/
git commit -m "feat: make tunnel site_b nullable, add external_endpoint field"
```

---

### Task 2: Serializer updates — validation + cross-project fields

**Files:**
- Modify: `backend/apps/ipam/serializers.py:102-114` (TunnelSerializer)
- Modify: `backend/apps/ipam/serializers.py:157-168` (TunnelTopologySerializer)

**Step 1: Update TunnelSerializer**

Replace `TunnelSerializer` (lines 102-114) with:

```python
class TunnelSerializer(serializers.ModelSerializer):
    site_a_name = serializers.CharField(source="site_a.name", read_only=True)
    site_b_name = serializers.CharField(source="site_b.name", read_only=True, default=None)
    site_b_project_id = serializers.IntegerField(source="site_b.project_id", read_only=True, default=None)
    site_b_project_name = serializers.CharField(source="site_b.project.name", read_only=True, default=None)

    class Meta:
        model = Tunnel
        fields = [
            "id", "project", "name", "tunnel_type", "tunnel_subnet",
            "site_a", "site_a_name", "ip_a",
            "site_b", "site_b_name", "site_b_project_id", "site_b_project_name", "ip_b",
            "external_endpoint",
            "enabled", "description", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        site_b = attrs.get("site_b")
        external = attrs.get("external_endpoint", "")
        if site_b and external:
            raise serializers.ValidationError("Cannot set both site_b and external_endpoint.")
        if not site_b and not external:
            raise serializers.ValidationError("Either site_b or external_endpoint is required.")
        site_a = attrs.get("site_a") or (self.instance and self.instance.site_a)
        project = attrs.get("project") or (self.instance and self.instance.project)
        if site_a and project and site_a.project_id != project.id:
            raise serializers.ValidationError({"site_a": "Site A must belong to the tunnel's project."})
        return attrs
```

**Step 2: Update TunnelTopologySerializer**

Replace `TunnelTopologySerializer` (lines 157-168) with:

```python
class TunnelTopologySerializer(serializers.ModelSerializer):
    site_a_name = serializers.CharField(source="site_a.name", read_only=True)
    site_b_name = serializers.CharField(source="site_b.name", read_only=True, default=None)
    site_b_project_id = serializers.IntegerField(source="site_b.project_id", read_only=True, default=None)
    site_b_project_name = serializers.CharField(source="site_b.project.name", read_only=True, default=None)

    class Meta:
        model = Tunnel
        fields = [
            "id", "name", "tunnel_type", "tunnel_subnet",
            "site_a", "site_a_name", "ip_a",
            "site_b", "site_b_name", "site_b_project_id", "site_b_project_name", "ip_b",
            "external_endpoint", "enabled",
        ]
```

**Step 3: Update TunnelViewSet queryset for new select_related**

In `backend/apps/ipam/views.py:86`, change:

```python
qs = Tunnel.objects.select_related("site_a", "site_b", "project")
# to:
qs = Tunnel.objects.select_related("site_a", "site_b", "site_b__project", "project")
```

**Step 4: Commit**

```
git add backend/apps/ipam/serializers.py backend/apps/ipam/views.py
git commit -m "feat: add cross-project and external tunnel serializer fields + validation"
```

---

### Task 3: Topology view — cross-project tunnel visibility

**Files:**
- Modify: `backend/apps/projects/views.py:62` (topology action, tunnel query)

**Step 1: Update tunnel query in topology view**

In `backend/apps/projects/views.py:62`, replace:

```python
tunnels = Tunnel.objects.filter(project=project).select_related("site_a", "site_b")
```

with:

```python
from django.db.models import Q
tunnels = Tunnel.objects.filter(
    Q(project=project) | Q(site_b__project=project)
).select_related("site_a", "site_b", "site_b__project").distinct()
```

Add the `Q` import at the top of the file if not already present.

**Step 2: Verify cache invalidation**

The topology endpoint uses `@cache_page(30)` — this handles itself (30s TTL). No changes needed.

**Step 3: Commit**

```
git add backend/apps/projects/views.py
git commit -m "feat: include cross-project tunnels in topology endpoint"
```

---

### Task 4: Frontend types — update Tunnel and TunnelTopology

**Files:**
- Modify: `frontend/src/types/index.ts:97-113` (Tunnel interface)
- Modify: `frontend/src/types/index.ts:150-162` (TunnelTopology interface)

**Step 1: Update Tunnel interface**

```typescript
export interface Tunnel {
  id: number
  project: number
  name: string
  tunnel_type: TunnelType
  tunnel_subnet: string
  site_a: number
  site_a_name: string
  ip_a: string
  site_b: number | null
  site_b_name: string | null
  site_b_project_id: number | null
  site_b_project_name: string | null
  ip_b: string
  external_endpoint: string
  enabled: boolean
  description: string
  created_at: string
  updated_at: string
}
```

**Step 2: Update TunnelTopology interface**

```typescript
export interface TunnelTopology {
  id: number
  name: string
  tunnel_type: TunnelType
  tunnel_subnet: string
  site_a: number
  site_a_name: string
  ip_a: string
  site_b: number | null
  site_b_name: string | null
  site_b_project_id: number | null
  site_b_project_name: string | null
  ip_b: string
  external_endpoint: string
  enabled: boolean
}
```

**Step 3: Commit**

```
git add frontend/src/types/index.ts
git commit -m "feat: add cross-project and external fields to Tunnel types"
```

---

### Task 5: TunnelForm — three modes with checkboxes

**Files:**
- Modify: `frontend/src/components/data/forms/TunnelForm.tsx` (full rewrite of form)

**Step 1: Rewrite TunnelForm**

Key changes:
- Add `useState` for `mode`: `'internal' | 'crossProject' | 'external'`
- Add `useState` for `selectedProjectId` (for cross-project site list)
- Add query to load all projects (`projectsApi.list()`) when crossProject mode
- Add query to load sites of selected project
- Two checkboxes below Site B area:
  - "External tunnel" → toggles mode to `external`, shows text input for `external_endpoint`
  - "Cross-project tunnel" → toggles mode to `crossProject`, shows project select → site select
- Checkboxes are mutually exclusive (checking one unchecks the other)
- Payload: when external → `site_b: null, external_endpoint: value`; when crossProject → `site_b: id, external_endpoint: ""`
- Init mode from existing tunnel: if `tunnel.external_endpoint` → external; if `tunnel.site_b_project_id && tunnel.site_b_project_id !== projectId` → crossProject; else internal

**Step 2: Run `npx tsc --noEmit` to verify types**

**Step 3: Commit**

```
git add frontend/src/components/data/forms/TunnelForm.tsx
git commit -m "feat: add cross-project and external tunnel modes to TunnelForm"
```

---

### Task 6: Table view — render cross-project and external tunnels

**Files:**
- Modify: `frontend/src/components/data/tables/ProjectTableView.tsx:380-383`

**Step 1: Update tunnel endpoint display**

In ProjectTableView, line 383, replace the tunnel endpoints line:

```tsx
{tunnel.site_a_name} (<CopyableIP ip={tunnel.ip_a} />) →{' '}
{tunnel.site_b ? (
  <>
    {tunnel.site_b_project_id && tunnel.site_b_project_id !== projectId && (
      <a
        href={`/projects/${tunnel.site_b_project_id}`}
        onClick={(e) => { e.stopPropagation(); navigate(`/projects/${tunnel.site_b_project_id}`) }}
        className="text-primary hover:underline"
      >
        {tunnel.site_b_project_name} /
      </a>
    )}{' '}
    {tunnel.site_b_name} (<CopyableIP ip={tunnel.ip_b} />)
  </>
) : (
  <span className="italic text-muted-foreground">{tunnel.external_endpoint} (<CopyableIP ip={tunnel.ip_b} />)</span>
)}
```

Note: need `projectId` from URL params (`useParams`) and `navigate` — check if already available in component scope.

**Step 2: Commit**

```
git add frontend/src/components/data/tables/ProjectTableView.tsx
git commit -m "feat: render cross-project and external tunnels in table view"
```

---

### Task 7: Topology canvas — external/cross-project tunnel nodes and edges

**Files:**
- Modify: `frontend/src/lib/topology.utils.ts:447-464` (tunnel edge creation)
- Modify: `frontend/src/lib/topology.utils.ts:84-91` (TunnelEdgeData interface)
- Modify: `frontend/src/components/topology/edges/TunnelEdge.tsx` (render external label)

**Step 1: Update TunnelEdgeData interface**

Add fields to `TunnelEdgeData` in `topology.utils.ts`:

```typescript
export interface TunnelEdgeData {
  label: string
  tunnelType: string
  enabled: boolean
  ipA: string
  ipB: string
  offsetSide: number
  externalEndpoint?: string          // new
  crossProjectName?: string          // new — "ProjectName / SiteName"
  crossProjectId?: number            // new — for navigation
  [key: string]: unknown
}
```

**Step 2: Update tunnel edge creation in topologyToFlow**

For each tunnel, handle three cases:
- **Internal** (site_b exists, same project): edge source=`site-{site_a}`, target=`site-{site_b}` (unchanged)
- **Cross-project** (site_b exists, different project `site_b_project_id != null`): Create a virtual node for the external site, edge from site_a to virtual node. Virtual node data includes projectId for click navigation.
- **External** (site_b is null): Create a virtual "external" node with the endpoint text. Edge from site_a to this node. No navigation.

Virtual nodes: simple small boxes positioned near site_a node.

**Step 3: Update TunnelEdge component**

Add rendering for cross-project badge at target end — clickable label with project/site name, colored differently (e.g. amber border). For external tunnels, show italic text label.

**Step 4: Commit**

```
git add frontend/src/lib/topology.utils.ts frontend/src/components/topology/edges/TunnelEdge.tsx
git commit -m "feat: render cross-project and external tunnels in topology view"
```

---

### Task 8: Geo map — cross-project tunnel lines and markers

**Files:**
- Modify: `frontend/src/components/geo/GeoMap.tsx:103-123` (tunnel rendering)

**Step 1: Update tunnel rendering in GeoMap**

For each tunnel in `topology.tunnels`:
- **Internal**: unchanged (line between two site markers)
- **Cross-project with coords**: render line + marker for the external site in a different color (e.g. amber). Add popup with project/site name and a link/button that navigates to the project.
- **External** or **cross-project without coords**: skip rendering on map (no coordinates available)

Use `tunnel.site_b_project_id` to detect cross-project. If `site_b` is not in `siteMap` (current project's sites), look up coords from a separate query or from the tunnel topology data. Note: topology already includes `site_b` site_id — to get coords, we may need to add `site_b_latitude`/`site_b_longitude` to the topology serializer, OR fetch from the sites API.

Simplest approach: add `site_b_latitude` and `site_b_longitude` to `TunnelTopologySerializer` as SerializerMethodFields. This avoids extra API calls.

**Step 2: Backend — add coords to TunnelTopologySerializer**

In `backend/apps/ipam/serializers.py`, add to `TunnelTopologySerializer`:

```python
site_b_latitude = serializers.FloatField(source="site_b.latitude", read_only=True, default=None)
site_b_longitude = serializers.FloatField(source="site_b.longitude", read_only=True, default=None)
```

Add these to `fields` list. Update `TunnelTopology` TypeScript interface accordingly.

**Step 3: Commit**

```
git add frontend/src/components/geo/GeoMap.tsx backend/apps/ipam/serializers.py frontend/src/types/index.ts
git commit -m "feat: render cross-project tunnels on geo map with markers"
```

---

### Task 9: Detail panel + sidebar — handle nullable site_b

**Files:**
- Modify: `frontend/src/components/layout/DetailPanel.tsx` (tunnel detail display)
- Modify: `frontend/src/components/layout/Sidebar.tsx` (tunnel listing)

**Step 1: Update any references to `tunnel.site_b_name`**

Search for `site_b_name` in both files and wrap with null check:

```tsx
{tunnel.site_b_name ?? tunnel.external_endpoint ?? 'External'}
```

Add cross-project link where site_b_project_id differs from current project.

**Step 2: Commit**

```
git add frontend/src/components/layout/DetailPanel.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: handle external and cross-project tunnels in sidebar and detail panel"
```

---

### Task 10: Verification and final build

**Step 1: TypeScript check**

Run: `cd /srv/ripe-net/frontend && npx tsc --noEmit`
Expected: No errors

**Step 2: Build**

Run: `npm run build`
Expected: Successful build

**Step 3: Browser test**

Test in browser:
1. Create an internal tunnel (existing flow — should still work)
2. Create a cross-project tunnel (check "Cross-project", pick other project + site)
3. Create an external tunnel (check "External", type endpoint name)
4. Verify all three appear in table, topology, and geo map
5. Verify cross-project tunnel is visible in both projects' topology
6. Click cross-project link → navigates to other project

**Step 4: Final commit**

```
git add -A
git commit -m "feat: cross-project and external tunnels — complete implementation"
git push
```
