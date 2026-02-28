# Port Template Serialization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bulk port template creation via pattern serialization + re-apply on existing hosts.

**Architecture:** Hybrid — frontend generates preview from pattern, bulk POST to backend. Re-apply button on hosts with confirmation.

**Tech Stack:** Django 5 + DRF, React 18 + TypeScript + TanStack Query

---

## Task 1: Backend — Bulk Create Endpoint

**Files:**
- Modify: `backend/apps/ipam/views.py` (PortTemplateViewSet, add `bulk_create` action)
- Modify: `backend/apps/ipam/urls.py` (add URL pattern)

**Step 1: Add bulk_create action to PortTemplateViewSet**

In `backend/apps/ipam/views.py`, add this action to `PortTemplateViewSet` (after the existing `apply` action at line ~296):

```python
@action(detail=False, methods=["post"], url_path="bulk-create")
def bulk_create(self, request, device_type_pk=None):
    """Create multiple port templates at once."""
    dt = get_object_or_404(DeviceType, pk=device_type_pk)
    templates_data = request.data.get("templates", [])

    if not isinstance(templates_data, list) or len(templates_data) == 0:
        return Response(
            {"detail": "Provide a non-empty 'templates' list."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(templates_data) > 200:
        return Response(
            {"detail": "Maximum 200 templates per request."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check for duplicate names within request
    names = [t.get("name", "").strip() for t in templates_data]
    if len(names) != len(set(names)):
        return Response(
            {"detail": "Duplicate names in request."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check for conflicts with existing templates
    existing = set(dt.port_templates.values_list("name", flat=True))
    conflicts = [n for n in names if n in existing]
    if conflicts:
        return Response(
            {"detail": f"Names already exist: {', '.join(conflicts[:10])}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Determine starting position
    max_pos = dt.port_templates.aggregate(m=models.Max("position"))["m"] or 0

    created = []
    with transaction.atomic():
        for i, tpl_data in enumerate(templates_data, start=1):
            name = tpl_data.get("name", "").strip()
            port_type = tpl_data.get("port_type", "rj45")
            if not name:
                continue
            obj = PortTemplate.objects.create(
                device_type=dt,
                name=name,
                port_type=port_type,
                position=max_pos + i,
            )
            created.append(obj)

    serializer = self.get_serializer(created, many=True)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
```

Ensure `from django.db import models, transaction` and `from rest_framework import status` are imported at top of file.

**Step 2: Add URL pattern**

In `backend/apps/ipam/urls.py`, add after the existing `port-template-apply` path (line ~28):

```python
path(
    "device-types/<int:device_type_pk>/port-templates/bulk-create/",
    views.PortTemplateViewSet.as_view({"post": "bulk_create"}),
    name="port-template-bulk-create",
),
```

**Step 3: Verify**

Run: `cd /srv/ripe-net/backend && python manage.py check`
Expected: System check identified no issues.

**Step 4: Commit**

```bash
git add backend/apps/ipam/views.py backend/apps/ipam/urls.py
git commit -m "Add bulk-create endpoint for port templates"
```

---

## Task 2: Backend — Apply Port Template on Host

**Files:**
- Modify: `backend/apps/ipam/views.py` (HostViewSet, add `apply_port_template` action)
- Modify: `backend/apps/ipam/urls.py` (add URL pattern — or use router auto-detection)

**Step 1: Add apply_port_template action to HostViewSet**

In `backend/apps/ipam/views.py`, add this action to `HostViewSet`:

```python
@action(detail=True, methods=["post"], url_path="apply-port-template")
def apply_port_template(self, request, pk=None):
    """Apply port templates from host's device type."""
    host = self.get_object()
    if not host.device_type:
        return Response(
            {"detail": "Host has no device type.", "created": 0},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        dt = DeviceType.objects.get(value=host.device_type)
    except DeviceType.DoesNotExist:
        return Response(
            {"detail": f"Device type '{host.device_type}' not found.", "created": 0},
            status=status.HTTP_404_NOT_FOUND,
        )

    templates = dt.port_templates.all()
    if not templates.exists():
        return Response(
            {"detail": "No port templates defined for this device type.", "created": 0},
        )

    created = 0
    with transaction.atomic():
        for tpl in templates:
            _, was_created = DevicePort.objects.get_or_create(
                host=host, name=tpl.name,
                defaults={"port_type": tpl.port_type, "position": tpl.position},
            )
            if was_created:
                created += 1

    return Response({"detail": f"Created {created} port(s) from template.", "created": created})
```

Since HostViewSet uses `router.register`, the `@action(detail=True)` URL will be auto-generated as `/hosts/{pk}/apply-port-template/`. No URL change needed.

**Step 2: Verify**

Run: `cd /srv/ripe-net/backend && python manage.py check`

**Step 3: Commit**

```bash
git add backend/apps/ipam/views.py
git commit -m "Add apply-port-template endpoint on hosts"
```

---

## Task 3: Frontend — API Client Updates

**Files:**
- Modify: `frontend/src/api/endpoints.ts`

**Step 1: Add bulkCreate to portTemplatesApi**

After the existing `apply` method (line ~157):

```typescript
bulkCreate: (deviceTypeId: number, templates: Array<{ name: string; port_type: string }>) =>
  apiClient.post<PortTemplate[]>(`/device-types/${deviceTypeId}/port-templates/bulk-create/`, { templates }),
```

**Step 2: Add applyPortTemplate to hostsApi**

In the `hostsApi` object, add:

```typescript
applyPortTemplate: (hostId: number) =>
  apiClient.post<{ detail: string; created: number }>(`/hosts/${hostId}/apply-port-template/`),
```

**Step 3: Verify**

Run: `cd /srv/ripe-net/frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/api/endpoints.ts
git commit -m "Add bulkCreate and applyPortTemplate API methods"
```

---

## Task 4: Frontend — Series Generator in SettingsPage

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx` (PortTemplatesPanel component)

**Step 1: Add generateSeriesFromPattern helper function**

Before the `PortTemplatesPanel` function, add:

```typescript
function generateSeriesFromPattern(
  pattern: string,
  start: number,
  end: number,
  step: number,
): string[] {
  const match = pattern.match(/\{(N+)\}/)
  if (!match) return []
  const padLen = match[1].length  // {N}=1, {NN}=2, {NNN}=3
  const results: string[] = []
  for (let i = start; i <= end; i += step) {
    const num = padLen > 1 ? String(i).padStart(padLen, '0') : String(i)
    results.push(pattern.replace(match[0], num))
  }
  return results
}
```

**Step 2: Add series generator state and UI to PortTemplatesPanel**

Inside the `PortTemplatesPanel` component, add state:

```typescript
const [showGenerator, setShowGenerator] = useState(false)
const [genPattern, setGenPattern] = useState('')
const [genPortType, setGenPortType] = useState('rj45')
const [genStart, setGenStart] = useState('1')
const [genEnd, setGenEnd] = useState('24')
const [genStep, setGenStep] = useState('1')
```

Add bulk create mutation:

```typescript
const bulkMutation = useMutation({
  mutationFn: (templates: Array<{ name: string; port_type: string }>) =>
    portTemplatesApi.bulkCreate(deviceTypeId, templates),
  onSuccess: (res) => {
    queryClient.invalidateQueries({ queryKey: ['port-templates', deviceTypeId] })
    setShowGenerator(false)
    setGenPattern('')
    toast.success(`Added ${res.data.length} port templates`)
  },
  onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to create templates')),
})
```

Add preview computation:

```typescript
const preview = genPattern.match(/\{N+\}/)
  ? generateSeriesFromPattern(
      genPattern,
      parseInt(genStart) || 0,
      parseInt(genEnd) || 0,
      Math.max(1, parseInt(genStep) || 1),
    )
  : []
```

**Step 3: Add generator UI JSX**

Between the single-add form and the "Apply to existing hosts" button, add:

```tsx
{!showGenerator ? (
  <button
    onClick={() => setShowGenerator(true)}
    className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1 text-xs hover:bg-accent"
  >
    <List className="h-3.5 w-3.5" />
    Generate series
  </button>
) : (
  <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
    <h4 className="text-xs font-medium">Generate Port Series</h4>
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <label className="text-[10px] text-muted-foreground">Pattern (use {'{N}'}, {'{NN}'}, {'{NNN}'})</label>
        <input
          value={genPattern}
          onChange={(e) => setGenPattern(e.target.value)}
          placeholder="e.g. ether{N}"
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
        />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">Type</label>
        <select
          value={genPortType}
          onChange={(e) => setGenPortType(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          {PORT_TYPE_OPTIONS.map((pt) => (
            <option key={pt} value={pt}>{pt}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <div>
          <label className="text-[10px] text-muted-foreground">Start</label>
          <input
            value={genStart}
            onChange={(e) => setGenStart(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">End</label>
          <input
            value={genEnd}
            onChange={(e) => setGenEnd(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Step</label>
          <input
            value={genStep}
            onChange={(e) => setGenStep(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
      </div>
    </div>

    {preview.length > 0 && (
      <div className="text-[10px] text-muted-foreground">
        <span className="font-medium">Preview ({preview.length}):</span>{' '}
        {preview.length <= 10
          ? preview.join(', ')
          : `${preview.slice(0, 5).join(', ')}, ... ${preview.slice(-3).join(', ')}`}
      </div>
    )}

    {preview.length > 200 && (
      <p className="text-[10px] text-red-500">Maximum 200 ports per series.</p>
    )}

    <div className="flex gap-2">
      <button
        onClick={() => setShowGenerator(false)}
        className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent"
      >
        Cancel
      </button>
      <button
        onClick={() => {
          if (preview.length === 0 || preview.length > 200) return
          bulkMutation.mutate(preview.map((name) => ({ name, port_type: genPortType })))
        }}
        disabled={preview.length === 0 || preview.length > 200 || bulkMutation.isPending}
        className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {bulkMutation.isPending ? 'Adding...' : `Add ${preview.length} ports`}
      </button>
    </div>
  </div>
)}
```

Add `List` to lucide-react imports at the top of the file.

**Step 4: Verify**

Run: `cd /srv/ripe-net/frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "Add port series generator to SettingsPage"
```

---

## Task 5: Frontend — Re-Apply Template on Host (DetailPanel)

**Files:**
- Modify: `frontend/src/components/layout/DetailPanel.tsx` (HostPortsSection)

**Step 1: Add "Sync from template" button to HostPortsSection**

The `HostPortsSection` component (line ~621) needs:

1. Import `hostsApi` (already imported) and `deviceTypesApi` + `portTemplatesApi`
2. Accept `deviceType` prop from parent `HostDetail`
3. Fetch port templates for the host's device type
4. Add confirmation dialog + mutation

In `HostPortsSection`, add these props and state:

```typescript
function HostPortsSection({ hostId, deviceType }: { hostId: number; deviceType?: string }) {
  // ...existing code...
  const [confirmSync, setConfirmSync] = useState(false)
```

Add query to check if templates exist:

```typescript
const { data: deviceTypeObj } = useQuery({
  queryKey: ['device-types'],
  queryFn: () => deviceTypesApi.list(),
  select: (res) => res.data.find((dt) => dt.value === deviceType),
  enabled: !!deviceType,
})

const { data: templates } = useQuery({
  queryKey: ['port-templates', deviceTypeObj?.id],
  queryFn: () => portTemplatesApi.list(deviceTypeObj!.id),
  select: (res) => res.data,
  enabled: !!deviceTypeObj?.id,
})

const hasTemplates = templates && templates.length > 0
```

Add sync mutation:

```typescript
const syncMutation = useMutation({
  mutationFn: () => hostsApi.applyPortTemplate(hostId),
  onSuccess: (res) => {
    queryClient.invalidateQueries({ queryKey: ['ports'] })
    queryClient.invalidateQueries({ queryKey: ['physical-topology'] })
    setConfirmSync(false)
    toast.success(res.data.detail)
  },
  onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to sync ports')),
})
```

Add button next to `+ Port`:

```tsx
{hasTemplates && (
  <button
    onClick={() => setConfirmSync(true)}
    className="text-xs text-primary hover:underline flex items-center gap-1"
    title="Sync ports from device type template"
  >
    <Zap className="h-3 w-3" /> Sync
  </button>
)}
```

Add confirmation dialog:

```tsx
<Dialog open={confirmSync} onOpenChange={setConfirmSync} title="Sync Ports from Template">
  <div className="space-y-3">
    <p className="text-sm">
      Sync ports from device type template? Missing ports will be added.
      Existing ports won't be changed or deleted.
    </p>
    <div className="flex gap-2 justify-end">
      <button
        onClick={() => setConfirmSync(false)}
        className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-accent"
      >
        Cancel
      </button>
      <button
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {syncMutation.isPending ? 'Syncing...' : 'Sync'}
      </button>
    </div>
  </div>
</Dialog>
```

**Step 2: Pass deviceType from HostDetail to HostPortsSection**

In `HostDetail` (line ~484), change:

```tsx
<HostPortsSection hostId={hostId} />
```
to:
```tsx
<HostPortsSection hostId={hostId} deviceType={host.device_type} />
```

**Step 3: Add Zap import**

Add `Zap` to the lucide-react import at the top of DetailPanel.tsx.

**Step 4: Verify**

Run: `cd /srv/ripe-net/frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/components/layout/DetailPanel.tsx
git commit -m "Add sync-from-template button to host detail panel"
```

---

## Task 6: Build & Deploy

**Step 1: Rebuild frontend**

```bash
cd /srv/ripe-net/frontend && npm run build
```

**Step 2: Rebuild containers**

```bash
cd /srv/ripe-net && docker compose up --build --force-recreate -d frontend backend
```

**Step 3: Manual verification**

1. Go to Settings > Device Types
2. Expand a device type, click "Generate series"
3. Enter pattern `ether{N}`, start=1, end=24, step=1
4. Verify preview shows ether1...ether24
5. Click "Add 24 ports" — verify templates appear in table
6. Create a new host with that device type — verify ports auto-created
7. Go to host detail panel → click "Sync" on ports section
8. Confirm dialog → verify ports synced
