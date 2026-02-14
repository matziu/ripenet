import { useState } from 'react'
import { useUIStore } from '@/stores/ui.store'
import { useSelectionStore } from '@/stores/selection.store'
import { useTopologyStore } from '@/stores/topology.store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi, vlansApi, subnetsApi, hostsApi } from '@/api/endpoints'
import { CopyableIP } from '@/components/shared/CopyableIP'
import { cn } from '@/lib/utils'
import { SubnetUtilBar } from '@/components/shared/SubnetUtilBar'
import { Dialog } from '@/components/ui/Dialog'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { VlanForm } from '@/components/data/forms/VlanForm'
import { SubnetForm } from '@/components/data/forms/SubnetForm'
import { HostForm } from '@/components/data/forms/HostForm'
import { toast } from 'sonner'
import type { Host } from '@/types'
import {
  X, Pencil, Trash2, Plus,
  MapPin, Network, Server, Monitor,
} from 'lucide-react'

export function DetailPanel({ className }: { className?: string }) {
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)

  // Selection from sidebar
  const selectedSiteId = useSelectionStore((s) => s.selectedSiteId)
  const selectedVlanId = useSelectionStore((s) => s.selectedVlanId)
  const selectedSubnetId = useSelectionStore((s) => s.selectedSubnetId)
  const selectedHostId = useSelectionStore((s) => s.selectedHostId)
  const selectedProjectId = useSelectionStore((s) => s.selectedProjectId)

  // Also listen to topology store for VLAN clicks from the topology view
  const topoVlanId = useTopologyStore((s) => s.selectedVlanId)

  // Priority: Host > Subnet > VLAN (sidebar or topology) > Site
  const activeView = selectedHostId
    ? 'host'
    : selectedSubnetId
      ? 'subnet'
      : (selectedVlanId || topoVlanId)
        ? 'vlan'
        : selectedSiteId
          ? 'site'
          : null

  const effectiveVlanId = selectedVlanId || topoVlanId

  return (
    <aside className={cn("w-80 border-l border-border bg-card overflow-y-auto", className)}>
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold">Details</h3>
        <button onClick={toggleDetailPanel} className="p-1 rounded hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      {activeView === 'site' && selectedSiteId && selectedProjectId && (
        <SiteDetail siteId={selectedSiteId} projectId={selectedProjectId} />
      )}
      {activeView === 'vlan' && effectiveVlanId && (
        <VlanDetail vlanId={effectiveVlanId} />
      )}
      {activeView === 'subnet' && selectedSubnetId && (
        <SubnetDetail subnetId={selectedSubnetId} />
      )}
      {activeView === 'host' && selectedHostId && (
        <HostDetail hostId={selectedHostId} />
      )}
      {!activeView && (
        <div className="p-3 text-xs text-muted-foreground">
          Select an item in the sidebar or topology to see details.
        </div>
      )}
    </aside>
  )
}

// ── Site Detail ──────────────────────────────────────────────

function SiteDetail({ siteId, projectId }: { siteId: number; projectId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: site } = useQuery({
    queryKey: ['site', projectId, siteId],
    queryFn: () => sitesApi.get(projectId, siteId),
    select: (res) => res.data,
  })

  const deleteMutation = useMutation({
    mutationFn: () => sitesApi.delete(projectId, siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedSite(null)
      toast.success('Site deleted')
    },
  })

  if (!site) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">{site.name}</span>
      </div>

      <dl className="space-y-1.5 text-xs">
        {site.address && <DetailRow label="Address" value={site.address} />}
        {site.latitude != null && site.longitude != null && (
          <DetailRow label="Coordinates" value={`${site.latitude}, ${site.longitude}`} mono />
        )}
        <DetailRow label="VLANs" value={String(site.vlan_count)} />
        <DetailRow label="Hosts" value={String(site.host_count)} />
      </dl>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete site "${site.name}"?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Site">
        <SiteForm projectId={projectId} site={site} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── VLAN Detail ──────────────────────────────────────────────

function VlanDetail({ vlanId }: { vlanId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [addSubnetOpen, setAddSubnetOpen] = useState(false)

  const { data: vlan } = useQuery({
    queryKey: ['vlan', vlanId],
    queryFn: () => vlansApi.get(vlanId),
    select: (res) => res.data,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { vlan: vlanId }],
    queryFn: () => hostsApi.list({ vlan: String(vlanId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: () => vlansApi.delete(vlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vlans'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedVlan(null)
      toast.success('VLAN deleted')
    },
  })

  const hosts = hostsData ?? []

  if (!vlan) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">VLAN {vlan.vlan_id} - {vlan.name}</span>
      </div>

      {vlan.purpose && (
        <p className="text-xs text-muted-foreground">{vlan.purpose}</p>
      )}

      <dl className="space-y-1.5 text-xs">
        <DetailRow label="Subnets" value={String(vlan.subnet_count)} />
        <DetailRow label="Hosts" value={String(vlan.host_count)} />
      </dl>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Hosts ({hosts.length})
          </h4>
          <button
            onClick={() => setAddSubnetOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Subnet
          </button>
        </div>
        <HostList hosts={hosts} />
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete VLAN ${vlan.vlan_id}?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit VLAN">
        <VlanForm siteId={vlan.site} vlan={vlan} onClose={() => setEditOpen(false)} />
      </Dialog>

      <Dialog open={addSubnetOpen} onOpenChange={setAddSubnetOpen} title="Add Subnet">
        <SubnetForm vlanId={vlanId} onClose={() => setAddSubnetOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Subnet Detail ────────────────────────────────────────────

function SubnetDetail({ subnetId }: { subnetId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [addHostOpen, setAddHostOpen] = useState(false)

  const { data: subnet } = useQuery({
    queryKey: ['subnet', subnetId],
    queryFn: () => subnetsApi.get(subnetId),
    select: (res) => res.data,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { subnet: subnetId }],
    queryFn: () => hostsApi.list({ subnet: String(subnetId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: () => subnetsApi.delete(subnetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedSubnet(null)
      toast.success('Subnet deleted')
    },
  })

  const hosts = hostsData ?? []

  if (!subnet) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold font-mono">{subnet.network}</span>
      </div>

      <SubnetUtilBar network={subnet.network} hostCount={subnet.host_count} variant="full" />

      <dl className="space-y-1.5 text-xs">
        {subnet.gateway && <DetailRow label="Gateway" value={subnet.gateway} mono />}
        {subnet.description && <DetailRow label="Description" value={subnet.description} />}
      </dl>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Hosts ({hosts.length})
          </h4>
          <button
            onClick={() => setAddHostOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Host
          </button>
        </div>
        <HostList hosts={hosts} />
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete subnet ${subnet.network}?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Subnet">
        <SubnetForm vlanId={subnet.vlan} subnet={subnet} onClose={() => setEditOpen(false)} />
      </Dialog>

      <Dialog open={addHostOpen} onOpenChange={setAddHostOpen} title="Add Host">
        <HostForm subnetId={subnetId} onClose={() => setAddHostOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Host Detail ──────────────────────────────────────────────

function HostDetail({ hostId }: { hostId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: host } = useQuery({
    queryKey: ['host', hostId],
    queryFn: () => hostsApi.get(hostId),
    select: (res) => res.data,
  })

  const deleteMutation = useMutation({
    mutationFn: () => hostsApi.delete(hostId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedHost(null)
      toast.success('Host deleted')
    },
  })

  if (!host) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <CopyableIP ip={host.ip_address} />
          {host.hostname && (
            <p className="text-xs text-muted-foreground truncate">{host.hostname}</p>
          )}
        </div>
      </div>

      <dl className="space-y-1.5 text-xs">
        {host.mac_address && <DetailRow label="MAC" value={host.mac_address} mono />}
        <DetailRow label="Device Type" value={host.device_type} />
        {host.description && <DetailRow label="Description" value={host.description} />}
      </dl>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete host ${host.ip_address}?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Host">
        <HostForm subnetId={host.subnet} host={host} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Shared helpers ───────────────────────────────────────────

function DetailLoading() {
  return <div className="p-3 text-xs text-muted-foreground">Loading...</div>
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono' : ''}>{value}</dd>
    </div>
  )
}

function DetailActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2 pt-1 border-t border-border">
      <button
        onClick={onEdit}
        className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent transition-colors"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="h-3 w-3" /> Delete
      </button>
    </div>
  )
}

function HostList({ hosts }: { hosts: Host[] }) {
  const setSelectedHost = useSelectionStore((s) => s.setSelectedHost)

  return (
    <div className="space-y-1">
      {hosts.map((host) => (
        <div
          key={host.id}
          onClick={() => setSelectedHost(host.id)}
          className="flex w-full items-center justify-between rounded-md border border-border p-2 text-xs hover:bg-accent/50 transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <CopyableIP ip={host.ip_address} />
            {host.hostname && (
              <p className="text-muted-foreground truncate mt-0.5">{host.hostname}</p>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">{host.device_type}</span>
        </div>
      ))}
      {hosts.length === 0 && (
        <p className="text-xs text-muted-foreground">No hosts</p>
      )}
    </div>
  )
}
