# Physical Topology (L1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Layer 1 physical topology — device ports (auto-created from templates on DeviceType), patch panels, cables connecting any two ports, and a per-Site React Flow visualization.

**Architecture:** Four new Django models (PortTemplate, DevicePort, PatchPanel, Cable) extend the existing `ipam` app. Port templates live on DeviceType and auto-create DevicePorts when hosts/patch panels are created. Frontend gets a new "physical" view mode (React Flow per Site), extended DetailPanel, and Settings refactored to sidebar navigation with sub-routes.

**Tech Stack:** Django 5 + DRF, PostgreSQL, React 18 + TypeScript + React Flow + Zustand + TanStack Query, Vite.

---

## Task 1: Backend models — PortTemplate, DevicePort, PatchPanel, Cable

**Files:**
- Create: `backend/apps/ipam/models/port_template.py`
- Create: `backend/apps/ipam/models/device_port.py`
- Create: `backend/apps/ipam/models/patch_panel.py`
- Create: `backend/apps/ipam/models/cable.py`
- Modify: `backend/apps/ipam/models/__init__.py`

**Step 1: Create PortTemplate model**

```python
# backend/apps/ipam/models/port_template.py
from django.db import models


class PortTemplate(models.Model):
    device_type = models.ForeignKey(
        "ipam.DeviceType", on_delete=models.CASCADE, related_name="port_templates",
    )
    name = models.CharField(max_length=100)
    port_type = models.CharField(max_length=30, default="rj45")
    position = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ipam_port_template"
        ordering = ["position", "name"]
        unique_together = [("device_type", "name")]

    def __str__(self):
        return f"{self.device_type.label} / {self.name}"
```

**Step 2: Create PatchPanel model**

```python
# backend/apps/ipam/models/patch_panel.py
from django.db import models

from apps.projects.models import Site


class PatchPanel(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="patch_panels")
    name = models.CharField(max_length=100)
    port_count = models.PositiveIntegerField(default=24)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_patch_panel"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.site.name})"
```

**Step 3: Create DevicePort model**

```python
# backend/apps/ipam/models/device_port.py
from django.db import models


class DevicePort(models.Model):
    host = models.ForeignKey(
        "ipam.Host", on_delete=models.CASCADE, related_name="ports",
        null=True, blank=True,
    )
    patch_panel = models.ForeignKey(
        "ipam.PatchPanel", on_delete=models.CASCADE, related_name="ports",
        null=True, blank=True,
    )
    name = models.CharField(max_length=100)
    port_type = models.CharField(max_length=30, default="rj45")
    position = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "ipam_device_port"
        ordering = ["position", "name"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(host__isnull=False, patch_panel__isnull=True)
                    | models.Q(host__isnull=True, patch_panel__isnull=False)
                ),
                name="port_belongs_to_one_device",
            ),
        ]

    def __str__(self):
        owner = self.host or self.patch_panel
        return f"{owner} / {self.name}"

    @property
    def site(self):
        if self.host:
            return self.host.subnet.site
        return self.patch_panel.site
```

**Step 4: Create Cable model**

```python
# backend/apps/ipam/models/cable.py
from django.db import models


class Cable(models.Model):
    port_a = models.OneToOneField(
        "ipam.DevicePort", on_delete=models.CASCADE, related_name="cable_as_a",
    )
    port_b = models.OneToOneField(
        "ipam.DevicePort", on_delete=models.CASCADE, related_name="cable_as_b",
    )
    cable_type = models.CharField(max_length=30, default="cat6")
    label = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_cable"
        ordering = ["label"]

    def __str__(self):
        return f"{self.port_a} <-> {self.port_b}"
```

**Step 5: Update `models/__init__.py`**

Add to existing imports:
```python
from .port_template import PortTemplate
from .device_port import DevicePort
from .patch_panel import PatchPanel
from .cable import Cable

# Add to __all__: "PortTemplate", "DevicePort", "PatchPanel", "Cable"
```

**Step 6: Create and run migration**

```bash
docker compose exec web python manage.py makemigrations ipam --name physical_topology
docker compose exec web python manage.py migrate ipam
```

**Step 7: Commit**

```bash
git add backend/apps/ipam/models/ backend/apps/ipam/migrations/
git commit -m "Add models: PortTemplate, DevicePort, PatchPanel, Cable"
```

---

## Task 2: Auto-create ports on Host and PatchPanel creation

**Files:**
- Modify: `backend/apps/ipam/models/host.py` (add signal or override save)
- Modify: `backend/apps/ipam/models/patch_panel.py` (override save)

**Step 1: Auto-create ports for Host**

Add a `post_save` signal in a new file:

```python
# backend/apps/ipam/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Host, PatchPanel, DevicePort, DeviceType


@receiver(post_save, sender=Host)
def create_host_ports(sender, instance, created, **kwargs):
    if not created:
        return
    try:
        dt = DeviceType.objects.get(value=instance.device_type)
    except DeviceType.DoesNotExist:
        return
    for tpl in dt.port_templates.all():
        DevicePort.objects.get_or_create(
            host=instance, name=tpl.name,
            defaults={"port_type": tpl.port_type, "position": tpl.position},
        )


@receiver(post_save, sender=PatchPanel)
def create_patch_panel_ports(sender, instance, created, **kwargs):
    if not created:
        return
    for i in range(1, instance.port_count + 1):
        DevicePort.objects.get_or_create(
            patch_panel=instance, name=f"Port {i}",
            defaults={"port_type": "rj45", "position": i},
        )
```

**Step 2: Register signals in AppConfig**

```python
# backend/apps/ipam/apps.py — add ready() method
class IpamConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ipam"

    def ready(self):
        import apps.ipam.signals  # noqa: F401
```

**Step 3: Commit**

```bash
git add backend/apps/ipam/signals.py backend/apps/ipam/apps.py
git commit -m "Auto-create ports on Host and PatchPanel creation"
```

---

## Task 3: Backend serializers — PortTemplate, DevicePort, PatchPanel, Cable

**Files:**
- Modify: `backend/apps/ipam/serializers.py`

**Step 1: Add serializers**

Append to `serializers.py`:

```python
class PortTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortTemplate
        fields = ["id", "device_type", "name", "port_type", "position"]
        read_only_fields = ["id"]


class DevicePortSerializer(serializers.ModelSerializer):
    cable = serializers.SerializerMethodField()

    class Meta:
        model = DevicePort
        fields = ["id", "host", "patch_panel", "name", "port_type", "position", "description", "cable"]
        read_only_fields = ["id"]

    def get_cable(self, obj):
        cable = getattr(obj, "cable_as_a", None) or getattr(obj, "cable_as_b", None)
        if cable:
            return {"id": cable.id, "cable_type": cable.cable_type, "label": cable.label}
        return None

    def validate(self, attrs):
        host = attrs.get("host")
        patch_panel = attrs.get("patch_panel")
        if bool(host) == bool(patch_panel):
            raise serializers.ValidationError("Port must belong to exactly one of host or patch_panel.")
        return attrs


class PatchPanelSerializer(serializers.ModelSerializer):
    port_count_current = serializers.IntegerField(source="ports.count", read_only=True)

    class Meta:
        model = PatchPanel
        fields = ["id", "site", "name", "port_count", "description", "port_count_current", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class CableSerializer(serializers.ModelSerializer):
    port_a_display = serializers.CharField(source="port_a.__str__", read_only=True)
    port_b_display = serializers.CharField(source="port_b.__str__", read_only=True)

    class Meta:
        model = Cable
        fields = ["id", "port_a", "port_b", "cable_type", "label", "port_a_display", "port_b_display", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        port_a = attrs.get("port_a") or (self.instance and self.instance.port_a)
        port_b = attrs.get("port_b") or (self.instance and self.instance.port_b)
        if port_a and port_b and port_a.id == port_b.id:
            raise serializers.ValidationError("Cannot connect a port to itself.")
        return attrs
```

Update imports at top of file: add `PortTemplate, DevicePort, PatchPanel, Cable` to model imports.

**Step 2: Commit**

```bash
git add backend/apps/ipam/serializers.py
git commit -m "Add serializers for PortTemplate, DevicePort, PatchPanel, Cable"
```

---

## Task 4: Backend views and URLs

**Files:**
- Modify: `backend/apps/ipam/views.py`
- Modify: `backend/apps/ipam/urls.py`
- Modify: `backend/apps/ipam/filters.py`
- Modify: `backend/apps/ipam/admin.py`

**Step 1: Add filters**

```python
# In filters.py — add:
class DevicePortFilter(django_filters.FilterSet):
    host = django_filters.NumberFilter(field_name="host_id")
    patch_panel = django_filters.NumberFilter(field_name="patch_panel_id")
    site = django_filters.NumberFilter(method="filter_by_site")

    class Meta:
        model = DevicePort
        fields = ["host", "patch_panel"]

    def filter_by_site(self, queryset, name, value):
        return queryset.filter(
            models.Q(host__subnet__site_id=value) | models.Q(patch_panel__site_id=value)
        )


class CableFilter(django_filters.FilterSet):
    site = django_filters.NumberFilter(method="filter_by_site")

    class Meta:
        model = Cable
        fields = ["cable_type"]

    def filter_by_site(self, queryset, name, value):
        return queryset.filter(
            models.Q(port_a__host__subnet__site_id=value)
            | models.Q(port_a__patch_panel__site_id=value)
            | models.Q(port_b__host__subnet__site_id=value)
            | models.Q(port_b__patch_panel__site_id=value)
        ).distinct()


class PatchPanelFilter(django_filters.FilterSet):
    site = django_filters.NumberFilter(field_name="site_id")

    class Meta:
        model = PatchPanel
        fields = ["site"]
```

**Step 2: Add ViewSets**

```python
# In views.py — add:

class PortTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = PortTemplateSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def get_queryset(self):
        return PortTemplate.objects.filter(device_type_id=self.kwargs["device_type_pk"])

    def perform_create(self, serializer):
        serializer.save(device_type_id=self.kwargs["device_type_pk"])

    @action(detail=False, methods=["post"])
    def apply(self, request, device_type_pk=None):
        """Sync port templates to all existing hosts of this device type."""
        dt = DeviceType.objects.get(pk=device_type_pk)
        templates = dt.port_templates.all()
        hosts = Host.objects.filter(device_type=dt.value)
        created = 0
        for host in hosts:
            for tpl in templates:
                _, was_created = DevicePort.objects.get_or_create(
                    host=host, name=tpl.name,
                    defaults={"port_type": tpl.port_type, "position": tpl.position},
                )
                if was_created:
                    created += 1
        return Response({"detail": f"Created {created} port(s) across {hosts.count()} host(s)."})


class DevicePortViewSet(viewsets.ModelViewSet):
    serializer_class = DevicePortSerializer
    permission_classes = [ProjectPermission]
    filterset_class = DevicePortFilter
    pagination_class = None

    def get_queryset(self):
        return DevicePort.objects.select_related(
            "host", "host__subnet", "host__subnet__site",
            "patch_panel", "patch_panel__site",
        ).prefetch_related("cable_as_a", "cable_as_b")

    def destroy(self, request, *args, **kwargs):
        port = self.get_object()
        if hasattr(port, "cable_as_a") or hasattr(port, "cable_as_b"):
            return Response(
                {"detail": "Cannot delete port with connected cable. Remove cable first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class PatchPanelViewSet(viewsets.ModelViewSet):
    serializer_class = PatchPanelSerializer
    permission_classes = [ProjectPermission]
    filterset_class = PatchPanelFilter

    def get_queryset(self):
        return PatchPanel.objects.select_related("site", "site__project").prefetch_related("ports")

    def destroy(self, request, *args, **kwargs):
        pp = self.get_object()
        cables = Cable.objects.filter(
            models.Q(port_a__patch_panel=pp) | models.Q(port_b__patch_panel=pp)
        )
        if cables.exists():
            return Response(
                {"detail": "Cannot delete patch panel with connected cables."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class CableViewSet(viewsets.ModelViewSet):
    serializer_class = CableSerializer
    permission_classes = [ProjectPermission]
    filterset_class = CableFilter

    def get_queryset(self):
        return Cable.objects.select_related(
            "port_a__host", "port_a__patch_panel",
            "port_b__host", "port_b__patch_panel",
        )
```

**Step 3: Add URLs**

```python
# In urls.py — add nested router for port templates + flat routers:
from rest_framework_nested.routers import NestedDefaultRouter
# ... or simple manual URL if rest_framework_nested not available:

router.register(r"ports", views.DevicePortViewSet, basename="deviceport")
router.register(r"patch-panels", views.PatchPanelViewSet, basename="patchpanel")
router.register(r"cables", views.CableViewSet, basename="cable")

# For nested port-templates under device-types, add manual path:
urlpatterns = [
    path("", include(router.urls)),
    path(
        "device-types/<int:device_type_pk>/port-templates/",
        views.PortTemplateViewSet.as_view({"get": "list", "post": "create"}),
        name="port-template-list",
    ),
    path(
        "device-types/<int:device_type_pk>/port-templates/apply/",
        views.PortTemplateViewSet.as_view({"post": "apply"}),
        name="port-template-apply",
    ),
    path(
        "device-types/<int:device_type_pk>/port-templates/<int:pk>/",
        views.PortTemplateViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="port-template-detail",
    ),
]
```

**Step 4: Register in admin**

```python
# In admin.py — add:
from .models import DevicePort, PatchPanel, Cable, PortTemplate

class PortTemplateInline(admin.TabularInline):
    model = PortTemplate
    extra = 0

# Modify DeviceTypeAdmin to include inline:
# Add inlines = [PortTemplateInline] to DeviceTypeAdmin

@admin.register(PatchPanel)
class PatchPanelAdmin(admin.ModelAdmin):
    list_display = ("name", "site", "port_count")
    list_filter = ("site__project",)

@admin.register(Cable)
class CableAdmin(admin.ModelAdmin):
    list_display = ("port_a", "port_b", "cable_type", "label")
    list_filter = ("cable_type",)
```

**Step 5: Commit**

```bash
git add backend/apps/ipam/views.py backend/apps/ipam/urls.py backend/apps/ipam/filters.py backend/apps/ipam/admin.py
git commit -m "Add views, URLs, filters, admin for physical topology"
```

---

## Task 5: Physical topology API endpoint

**Files:**
- Modify: `backend/apps/projects/views.py` (or `backend/apps/ipam/views.py`)

**Step 1: Add PhysicalTopologyView**

Add an endpoint that returns all hosts (with ports), patch panels (with ports), and cables for a given site:

```python
class PhysicalTopologyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, site_pk):
        hosts = Host.objects.filter(
            subnet__site_id=site_pk
        ).select_related("subnet").prefetch_related(
            Prefetch("ports", queryset=DevicePort.objects.order_by("position")),
        )
        patch_panels = PatchPanel.objects.filter(
            site_id=site_pk
        ).prefetch_related(
            Prefetch("ports", queryset=DevicePort.objects.order_by("position")),
        )
        # All cables touching this site (including cross-site)
        site_port_ids = DevicePort.objects.filter(
            models.Q(host__subnet__site_id=site_pk) | models.Q(patch_panel__site_id=site_pk)
        ).values_list("id", flat=True)
        cables = Cable.objects.filter(
            models.Q(port_a_id__in=site_port_ids) | models.Q(port_b_id__in=site_port_ids)
        ).select_related(
            "port_a__host", "port_a__patch_panel", "port_a__host__subnet__site",
            "port_b__host", "port_b__patch_panel", "port_b__host__subnet__site",
        )

        # Serialize (use dedicated topology serializers)
        return Response({
            "hosts": PhysicalHostSerializer(hosts, many=True).data,
            "patch_panels": PhysicalPatchPanelSerializer(patch_panels, many=True).data,
            "cables": PhysicalCableSerializer(cables, many=True).data,
        })
```

Add topology serializers and URL `sites/<int:site_pk>/physical-topology/`.

**Step 2: Commit**

```bash
git add backend/
git commit -m "Add physical topology API endpoint"
```

---

## Task 6: Frontend types and API client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/endpoints.ts`

**Step 1: Add TypeScript types**

```typescript
export interface PortTemplate {
  id: number
  device_type: number
  name: string
  port_type: string
  position: number
}

export interface DevicePort {
  id: number
  host: number | null
  patch_panel: number | null
  name: string
  port_type: string
  position: number
  description: string
  cable: { id: number; cable_type: string; label: string } | null
}

export interface PatchPanel {
  id: number
  site: number
  name: string
  port_count: number
  description: string
  port_count_current: number
  created_at: string
  updated_at: string
}

export interface Cable {
  id: number
  port_a: number
  port_b: number
  cable_type: string
  label: string
  port_a_display: string
  port_b_display: string
  created_at: string
  updated_at: string
}

export interface PhysicalTopology {
  hosts: PhysicalHost[]
  patch_panels: PhysicalPatchPanel[]
  cables: PhysicalCable[]
}

export interface PhysicalHost {
  id: number
  ip_address: string
  hostname: string
  device_type: string
  ports: { id: number; name: string; port_type: string; position: number }[]
}

export interface PhysicalPatchPanel {
  id: number
  name: string
  ports: { id: number; name: string; port_type: string; position: number }[]
}

export interface PhysicalCable {
  id: number
  port_a: number
  port_b: number
  cable_type: string
  label: string
  port_a_device: string
  port_b_device: string
}
```

**Step 2: Add API endpoints**

```typescript
export const portTemplatesApi = {
  list: (deviceTypeId: number) =>
    apiClient.get<PortTemplate[]>(`/device-types/${deviceTypeId}/port-templates/`),
  create: (deviceTypeId: number, data: Partial<PortTemplate>) =>
    apiClient.post<PortTemplate>(`/device-types/${deviceTypeId}/port-templates/`, data),
  update: (deviceTypeId: number, id: number, data: Partial<PortTemplate>) =>
    apiClient.patch<PortTemplate>(`/device-types/${deviceTypeId}/port-templates/${id}/`, data),
  delete: (deviceTypeId: number, id: number) =>
    apiClient.delete(`/device-types/${deviceTypeId}/port-templates/${id}/`),
  apply: (deviceTypeId: number) =>
    apiClient.post<{ detail: string }>(`/device-types/${deviceTypeId}/port-templates/apply/`),
}

export const portsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<DevicePort[]>('/ports/', { params }),
  create: (data: Partial<DevicePort>) =>
    apiClient.post<DevicePort>('/ports/', data),
  update: (id: number, data: Partial<DevicePort>) =>
    apiClient.patch<DevicePort>(`/ports/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/ports/${id}/`),
}

export const patchPanelsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<PatchPanel>>('/patch-panels/', { params }),
  get: (id: number) =>
    apiClient.get<PatchPanel>(`/patch-panels/${id}/`),
  create: (data: Partial<PatchPanel>) =>
    apiClient.post<PatchPanel>('/patch-panels/', data),
  update: (id: number, data: Partial<PatchPanel>) =>
    apiClient.patch<PatchPanel>(`/patch-panels/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/patch-panels/${id}/`),
}

export const cablesApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Cable>>('/cables/', { params }),
  get: (id: number) =>
    apiClient.get<Cable>(`/cables/${id}/`),
  create: (data: Partial<Cable>) =>
    apiClient.post<Cable>('/cables/', data),
  update: (id: number, data: Partial<Cable>) =>
    apiClient.patch<Cable>(`/cables/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/cables/${id}/`),
}

export const physicalTopologyApi = {
  get: (siteId: number) =>
    apiClient.get<PhysicalTopology>(`/sites/${siteId}/physical-topology/`),
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/endpoints.ts
git commit -m "Add frontend types and API client for physical topology"
```

---

## Task 7: Settings page refactor — sidebar navigation

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/App.tsx` (routing)

**Step 1: Refactor Settings to sidebar layout with sub-routes**

Replace `SettingsPage` with a layout component that has a mini-sidebar and renders sub-routes:
- `/settings` → redirect to `/settings/device-types`
- `/settings/device-types` → DeviceTypesSection (existing)
- `/settings/backup` → BackupSection (existing, extracted)
- `/settings/users` → redirect to `/users` (or embed later)

Use `NavLink` for sidebar items, `Outlet` for content area.

**Step 2: Add Port Templates subsection to Device Types**

Under each device type row, add expandable section with port templates table:
- List templates (name, port_type, position)
- Add template form
- "Apply to existing hosts" button

**Step 3: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/App.tsx
git commit -m "Refactor Settings page to sidebar navigation with port templates"
```

---

## Task 8: Frontend — extend DetailPanel (Ports section, PatchPanel, Cable details)

**Files:**
- Modify: `frontend/src/components/layout/DetailPanel.tsx`
- Modify: `frontend/src/stores/selection.store.ts`

**Step 1: Extend selection store**

Add: `selectedPatchPanelId`, `selectedCableId`, `selectedPortId` with setters (clear lower selections).

**Step 2: Add Ports section to HostDetail**

Below existing host data, add "Ports" section:
- Query `portsApi.list({ host: hostId })`
- Table: name | port_type | cable status ("Free" or cable label, clickable)
- "Add Port" button (manual)

**Step 3: Add PatchPanelDetail component**

New detail view for patch panels — name, site, description, port list (same pattern as HostDetail ports), edit/delete actions.

**Step 4: Add CableDetail component**

New detail view — cable type, label, Port A → device:port (clickable), Port B → device:port (clickable), edit/delete.

**Step 5: Update DetailPanel priority**

Add Port, Cable, PatchPanel to the priority chain in main DetailPanel component.

**Step 6: Commit**

```bash
git add frontend/src/components/layout/DetailPanel.tsx frontend/src/stores/selection.store.ts
git commit -m "Extend DetailPanel with ports, patch panels, and cable details"
```

---

## Task 9: Frontend — Sidebar extension (Patch Panels under Site)

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Step 1: Add PatchPanel tree items**

In `SiteTreeItem`, after VLANs and standalone subnets, add "Patch Panels" section:
- Query `patchPanelsApi.list({ site: siteId })` when site expanded
- Each patch panel is a clickable tree item (opens DetailPanel)
- Icon: `LayoutGrid` or `Rows3` from lucide-react

**Step 2: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "Add Patch Panels section to sidebar tree"
```

---

## Task 10: Frontend — Physical View (L1) with React Flow

**Files:**
- Create: `frontend/src/components/physical/PhysicalCanvas.tsx`
- Create: `frontend/src/components/physical/HostNode.tsx`
- Create: `frontend/src/components/physical/PatchPanelNode.tsx`
- Create: `frontend/src/components/physical/RemoteNode.tsx`
- Create: `frontend/src/components/physical/CableEdge.tsx`
- Create: `frontend/src/components/physical/PhysicalToolbar.tsx`
- Modify: `frontend/src/pages/ProjectPage.tsx` (add "physical" view mode)

**Step 1: Add "physical" to view modes**

In `ProjectPage.tsx`, extend `parseView` to accept `'physical'`, add keyboard shortcut `4`, add render case.

In TopBar or ProjectPage toolbar, add a 4th view button for "Physical".

**Step 2: Create PhysicalCanvas**

Main component: takes `siteId` prop (from selected site in sidebar).
- Query `physicalTopologyApi.get(siteId)`
- Convert data to React Flow nodes (HostNode per host, PatchPanelNode per patch panel) and edges (CableEdge per cable)
- Layout with dagre (top-down)
- Save positions in localStorage keyed by `physical-layout-${siteId}`

**Step 3: Create HostNode**

React Flow custom node:
- Card showing hostname/IP and device type
- List of ports along right edge, each as a Handle
- Free ports shown in muted color, connected ports highlighted
- Click node → open DetailPanel for host

**Step 4: Create PatchPanelNode**

React Flow custom node:
- Card showing patch panel name
- Ports on both edges (left and right) as Handles
- Click → DetailPanel for patch panel

**Step 5: Create RemoteNode**

For cross-site cables — dimmed/ghost card showing hostname and site name.
Click → navigate to that site's physical view.

**Step 6: Create CableEdge**

React Flow custom edge:
- Colored by cable_type (yellow=fiber_sm, orange=fiber_mm, blue=cat6, gray=cat5e, green=dac, white=other)
- Label shows cable label if set
- Click → DetailPanel for cable

**Step 7: Create PhysicalToolbar**

- Site selector (if not auto-selected from sidebar)
- Filter by device type
- Toggle: show/hide free ports
- Cable color legend

**Step 8: Commit**

```bash
git add frontend/src/components/physical/ frontend/src/pages/ProjectPage.tsx
git commit -m "Add Physical (L1) view with React Flow visualization"
```

---

## Task 11: Forms — PatchPanel, Cable, Port

**Files:**
- Create: `frontend/src/components/data/forms/PatchPanelForm.tsx`
- Create: `frontend/src/components/data/forms/CableForm.tsx`
- Create: `frontend/src/components/data/forms/PortForm.tsx`

**Step 1: PatchPanelForm**

Fields: name, port_count (only on create), description. Site passed as prop.

**Step 2: CableForm**

Fields:
- Port A: cascading dropdown — select device (host or patch panel) → select port (only free ports)
- Port B: same cascading dropdown
- Cable type: dropdown (cat5e/cat6/cat6a/fiber_sm/fiber_mm/dac/other)
- Label: text input

**Step 3: PortForm**

Fields: name, port_type dropdown, description. Host or PatchPanel ID passed as prop.

**Step 4: Commit**

```bash
git add frontend/src/components/data/forms/
git commit -m "Add forms for PatchPanel, Cable, and Port"
```

---

## Task 12: Final integration and verification

**Step 1: Run Django checks and migration**

```bash
docker compose exec web python manage.py check
docker compose exec web python manage.py migrate
```

**Step 2: Build frontend**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

**Step 3: Manual test checklist**

- [ ] Settings → Device Types → add port templates to a type
- [ ] Create host → ports auto-created from template
- [ ] Settings → "Apply to existing hosts" → adds missing ports
- [ ] Create patch panel in site → ports auto-created
- [ ] Create cable between two ports
- [ ] Cable blocked: port already connected, port to itself
- [ ] Delete cable, then delete port — works
- [ ] Delete port with cable — blocked
- [ ] Delete patch panel with cables — blocked
- [ ] Physical view shows devices and cables per site
- [ ] Cross-site cable shows remote node
- [ ] DetailPanel: host ports, patch panel, cable details
- [ ] Sidebar: patch panels listed under site

**Step 4: Commit and tag**

```bash
git add -A
git commit -m "Physical topology L1: cables, ports, patch panels — complete"
```
