import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { physicalTopologyApi, cablesApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { CableForm } from '@/components/data/forms/CableForm'
import { PatchPanelForm } from '@/components/data/forms/PatchPanelForm'
import { getCableColor } from './CableEdge'
import { Server, Grid3X3, Pencil, Trash2, Plus, Cable, ArrowRight, ChevronUp, ChevronDown, ArrowUpDown, Search } from 'lucide-react'
import type { PhysicalCable, PhysicalTopology, Cable as CableType } from '@/types'
import { useDeviceTypes } from '@/hooks/useDeviceTypes'
import { CopyableIP } from '@/components/shared/CopyableIP'

const cableTypeLabels: Record<string, string> = {
  fiber_sm: 'Fiber SM',
  fiber_mm: 'Fiber MM',
  cat6: 'Cat6',
  cat5e: 'Cat5e',
  cat6a: 'Cat6a',
  dac: 'DAC',
}

// --- Table row model ---

interface DirectRow {
  kind: 'direct'
  deviceA: { type: string; name: string }
  portA: string
  deviceB: { type: string; name: string }
  portB: string
  cableType: string
  label: string
  cable: PhysicalCable
}

interface PPSingleRow {
  kind: 'pp_single'
  device: { type: string; name: string }
  port: string
  pp: { name: string; ppPort: string }
  cableType: string
  label: string
  cable: PhysicalCable
}

type TableRow = DirectRow | PPSingleRow

// --- Build rows with normalization + end-to-end ---

function buildTableRows(
  data: PhysicalTopology,
  portNameMap: Map<number, string>,
): TableRow[] {
  const rows: TableRow[] = []

  for (const cable of data.cables) {
    const aIsPP = cable.port_a_device?.type === 'patch_panel'
    const bIsPP = cable.port_b_device?.type === 'patch_panel'

    if ((!aIsPP && !bIsPP) || (aIsPP && bIsPP)) {
      // Direct cable (host↔host or PP↔PP) — normalize: alphabetically by device name
      const nameA = cable.port_a_device?.name ?? ''
      const nameB = cable.port_b_device?.name ?? ''
      const swap = nameA.localeCompare(nameB) > 0

      rows.push({
        kind: 'direct',
        deviceA: swap
          ? { type: cable.port_b_device?.type ?? 'host', name: nameB }
          : { type: cable.port_a_device?.type ?? 'host', name: nameA },
        portA: portNameMap.get(swap ? cable.port_b : cable.port_a) ?? '—',
        deviceB: swap
          ? { type: cable.port_a_device?.type ?? 'host', name: nameA }
          : { type: cable.port_b_device?.type ?? 'host', name: nameB },
        portB: portNameMap.get(swap ? cable.port_a : cable.port_b) ?? '—',
        cableType: cable.cable_type,
        label: cable.label,
        cable,
      })
    } else {
      // PP cable (host↔PP) — always show as device → PP
      const host = getHostSide(cable)
      const pp = getPPSide(cable)

      rows.push({
        kind: 'pp_single',
        device: { type: 'host', name: host.deviceName },
        port: host.portName,
        pp: {
          name: pp?.name ?? '?',
          ppPort: pp?.portName ?? '?',
        },
        cableType: cable.cable_type,
        label: cable.label,
        cable,
      })
    }
  }

  // Sort: by left-side device name, then port
  rows.sort((a, b) => {
    const devCmp = getRowDeviceName(a).localeCompare(getRowDeviceName(b))
    if (devCmp !== 0) return devCmp
    return getRowPortName(a).localeCompare(getRowPortName(b))
  })

  return rows
}

function getHostSide(cable: PhysicalCable): { deviceName: string; portName: string; portId: number } {
  if (cable.port_a_device?.type !== 'patch_panel') {
    return { deviceName: cable.port_a_device?.name ?? '?', portName: '', portId: cable.port_a }
  }
  return { deviceName: cable.port_b_device?.name ?? '?', portName: '', portId: cable.port_b }
}

function getPPSide(cable: PhysicalCable): { name: string; portName: string; portId: number } | null {
  if (cable.port_a_device?.type === 'patch_panel') {
    return { name: cable.port_a_device.name, portName: '', portId: cable.port_a }
  }
  if (cable.port_b_device?.type === 'patch_panel') {
    return { name: cable.port_b_device.name, portName: '', portId: cable.port_b }
  }
  return null
}

function getRowDeviceName(row: TableRow): string {
  return row.kind === 'direct' ? row.deviceA.name : row.device.name
}

function getRowPortName(row: TableRow): string {
  return row.kind === 'direct' ? row.portA : row.port
}

// --- Sort & Filter helpers ---

type SortColumn = 'deviceA' | 'portA' | 'deviceB' | 'portB' | 'type' | 'label'

function getSortValue(row: TableRow, col: SortColumn): string {
  switch (col) {
    case 'deviceA':
      return row.kind === 'direct' ? row.deviceA.name : row.device.name
    case 'portA':
      return row.kind === 'direct' ? row.portA : row.port
    case 'deviceB':
      return row.kind === 'direct' ? row.deviceB.name : row.pp.name
    case 'portB':
      return row.kind === 'direct' ? row.portB : row.pp.ppPort
    case 'type':
      return row.cableType
    case 'label':
      return row.label
  }
}

function matchesFilter(row: TableRow, query: string): boolean {
  const fields: string[] = []
  if (row.kind === 'direct') {
    fields.push(row.deviceA.name, row.portA, row.deviceB.name, row.portB, row.cableType, row.label)
  } else {
    fields.push(row.device.name, row.port, row.pp.name, row.pp.ppPort, row.cableType, row.label)
  }
  return fields.some(f => f.toLowerCase().includes(query))
}

// --- SortableHeader ---

function SortableHeader({
  column,
  label,
  currentCol,
  currentDir,
  onSort,
}: {
  column: SortColumn
  label: string
  currentCol: SortColumn
  currentDir: 'asc' | 'desc'
  onSort: (col: SortColumn) => void
}) {
  const active = column === currentCol
  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {active ? (
        currentDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  )
}

// --- Component ---

interface PhysicalTableViewProps {
  siteId: number
  viewMode: 'graph' | 'table'
  onViewModeChange: (mode: 'graph' | 'table') => void
}

export function PhysicalTableView({ siteId, viewMode, onViewModeChange }: PhysicalTableViewProps) {
  const queryClient = useQueryClient()

  const { data: physicalData, isLoading } = useQuery({
    queryKey: ['physical-topology', siteId],
    queryFn: () => physicalTopologyApi.get(siteId),
    select: (res) => res.data,
    enabled: !!siteId,
  })

  const [dialog, setDialog] = useState<{
    mode: 'add' | 'edit'
    cable?: CableType
  } | null>(null)
  const [addPPOpen, setAddPPOpen] = useState(false)

  const [sortCol, setSortCol] = useState<SortColumn>('deviceA')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const handleSort = (col: SortColumn) => {
    if (col === sortCol) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const portNameMap = useMemo(() => {
    if (!physicalData) return new Map<number, string>()
    const map = new Map<number, string>()
    physicalData.hosts.forEach((h) => {
      h.ports.forEach((p) => map.set(p.id, p.name))
    })
    physicalData.patch_panels.forEach((pp) => {
      pp.ports.forEach((p) => map.set(p.id, p.name))
    })
    return map
  }, [physicalData])

  const allRows = useMemo(() => {
    if (!physicalData) return []
    const rows = buildTableRows(physicalData, portNameMap)
    for (const row of rows) {
      if (row.kind === 'direct') continue
      const h = getHostSide(row.cable)
      row.port = portNameMap.get(h.portId) ?? '?'
      const pp = getPPSide(row.cable)
      if (pp) row.pp.ppPort = portNameMap.get(pp.portId) ?? '?'
    }
    return rows
  }, [physicalData, portNameMap])

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>()
    for (const row of allRows) types.add(row.cableType)
    return [...types].sort()
  }, [allRows])

  const displayRows = useMemo(() => {
    let rows = [...allRows]

    if (filter) {
      const q = filter.toLowerCase()
      rows = rows.filter(row => matchesFilter(row, q))
    }
    if (typeFilter) {
      rows = rows.filter(row => row.cableType === typeFilter)
    }

    rows.sort((a, b) => {
      const valA = getSortValue(a, sortCol)
      const valB = getSortValue(b, sortCol)
      const cmp = valA.localeCompare(valB)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [allRows, filter, typeFilter, sortCol, sortDir])

  const deleteCable = useMutation({
    mutationFn: (id: number) => cablesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cables'] })
      queryClient.invalidateQueries({ queryKey: ['physical-topology', siteId] })
      toast.success('Cable deleted')
    },
    onError: (err) => toast.error(extractApiError(err, 'Failed to delete cable')),
  })

  const handleDelete = (cable: PhysicalCable) => {
    if (!window.confirm(`Delete cable "${cable.label || cable.id}"?`)) return
    deleteCable.mutate(cable.id)
  }

  const handleEdit = (cable: PhysicalCable) => {
    setDialog({
      mode: 'edit',
      cable: {
        id: cable.id,
        port_a: cable.port_a,
        port_b: cable.port_b,
        cable_type: cable.cable_type,
        label: cable.label,
        port_a_display: '',
        port_b_display: '',
        created_at: '',
        updated_at: '',
      },
    })
  }

  const dtMap = useDeviceTypes()

  // Build lookup maps from physicalData hosts
  const hostLookup = useMemo(() => {
    const nameToType = new Map<string, string>()
    const nameToIp = new Map<string, string>()
    if (physicalData) {
      for (const h of physicalData.hosts) {
        const key = h.hostname || h.ip_address
        nameToType.set(key, h.device_type)
        nameToIp.set(key, h.ip_address)
      }
    }
    return { nameToType, nameToIp }
  }, [physicalData])

  const DeviceCell = ({ type, name }: { type: string; name: string }) => {
    if (type === 'patch_panel') {
      return (
        <span className="flex items-center gap-1.5">
          <Grid3X3 className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-medium text-amber-600">{name}</span>
        </span>
      )
    }
    const dtValue = hostLookup.nameToType.get(name)
    const dt = dtValue ? dtMap.get(dtValue) : undefined
    const color = dt?.color
    const ip = hostLookup.nameToIp.get(name)
    return (
      <span className="flex items-center gap-1.5">
        <Server className="h-3.5 w-3.5" style={color ? { color } : undefined} />
        <span className="font-medium" style={color ? { color } : undefined}>{name}</span>
        {ip && ip !== name && (
          <CopyableIP ip={ip} className="text-[10px] text-muted-foreground" />
        )}
        {dt && (
          <span
            className="shrink-0 rounded px-1 py-0 text-[8px] font-bold uppercase border"
            style={{ backgroundColor: `${color}1a`, color, borderColor: `${color}33` }}
          >
            {dt.label}
          </span>
        )}
      </span>
    )
  }

  const CableTypeBadge = ({ type }: { type: string }) => (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
      style={{
        backgroundColor: getCableColor(type) + '20',
        color: getCableColor(type),
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: getCableColor(type) }}
      />
      {cableTypeLabels[type] ?? type}
    </span>
  )

  const ActionButtons = ({ cable }: { cable: PhysicalCable }) => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleEdit(cable)}
        className="rounded p-1 hover:bg-accent transition-colors"
        title="Edit cable"
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <button
        onClick={() => handleDelete(cable)}
        className="rounded p-1 hover:bg-destructive/10 transition-colors"
        title="Delete cable"
        disabled={deleteCable.isPending}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
      </button>
    </div>
  )

  const totalCables = physicalData?.cables.length ?? 0

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading physical topology...
      </div>
    )
  }

  if (!physicalData) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No physical topology data available.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <PhysicalViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
          <span className="text-[11px] text-muted-foreground">
            {filter || typeFilter ? `${displayRows.length} / ` : ''}
            {totalCables} cable{totalCables !== 1 ? 's' : ''}
          </span>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter..."
              className="h-7 w-40 rounded-md border border-border/50 bg-background pl-7 pr-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {uniqueTypes.length > 1 && (
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-7 rounded-md border border-border/50 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All types</option>
              {uniqueTypes.map(t => (
                <option key={t} value={t}>{cableTypeLabels[t] ?? t}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddPPOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Patch Panel
          </button>
          <button
            onClick={() => setDialog({ mode: 'add' })}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Cable
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {displayRows.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Cable className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {filter || typeFilter
                  ? 'No cables match the current filter.'
                  : 'No cables in this site yet. Click "Add Cable" to create one.'}
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-2"><SortableHeader column="deviceA" label="Device A" currentCol={sortCol} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-4 py-2"><SortableHeader column="portA" label="Port A" currentCol={sortCol} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-2 py-2 text-center w-10"></th>
                <th className="px-4 py-2"><SortableHeader column="portB" label="Port B" currentCol={sortCol} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-4 py-2"><SortableHeader column="deviceB" label="Device B" currentCol={sortCol} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-4 py-2"><SortableHeader column="type" label="Type" currentCol={sortCol} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-4 py-2"><SortableHeader column="label" label="Label" currentCol={sortCol} currentDir={sortDir} onSort={handleSort} /></th>
                <th className="px-4 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                if (row.kind === 'direct') {
                  return (
                    <tr
                      key={row.cable.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-2">
                        <DeviceCell type={row.deviceA.type} name={row.deviceA.name} />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{row.portA}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground/50">←→</td>
                      <td className="px-4 py-2 text-muted-foreground">{row.portB}</td>
                      <td className="px-4 py-2">
                        <DeviceCell type={row.deviceB.type} name={row.deviceB.name} />
                      </td>
                      <td className="px-4 py-2"><CableTypeBadge type={row.cableType} /></td>
                      <td className="px-4 py-2 text-muted-foreground">{row.label || '—'}</td>
                      <td className="px-4 py-2"><ActionButtons cable={row.cable} /></td>
                    </tr>
                  )
                }

                // pp_single
                return (
                  <tr
                    key={row.cable.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-2">
                      <DeviceCell type={row.device.type} name={row.device.name} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.port}</td>
                    <td className="px-2 py-2 text-center">
                      <ArrowRight className="h-3.5 w-3.5 text-amber-500 mx-auto" />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{row.pp.ppPort}</td>
                    <td className="px-4 py-2">
                      <DeviceCell type="patch_panel" name={row.pp.name} />
                    </td>
                    <td className="px-4 py-2"><CableTypeBadge type={row.cableType} /></td>
                    <td className="px-4 py-2 text-muted-foreground">{row.label || '—'}</td>
                    <td className="px-4 py-2"><ActionButtons cable={row.cable} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Cable Form Dialog */}
      <Dialog
        open={!!dialog}
        onOpenChange={() => setDialog(null)}
        title={dialog?.mode === 'edit' ? 'Edit Cable' : 'Add Cable'}
      >
        <CableForm
          siteId={siteId}
          cable={dialog?.cable}
          onClose={() => setDialog(null)}
        />
      </Dialog>

      {/* Patch Panel Form Dialog */}
      <Dialog open={addPPOpen} onOpenChange={setAddPPOpen} title="Add Patch Panel">
        <PatchPanelForm siteId={siteId} onClose={() => setAddPPOpen(false)} />
      </Dialog>
    </div>
  )
}

// Reusable view toggle used in both graph toolbar and table toolbar
export function PhysicalViewToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: 'graph' | 'table'
  onViewModeChange: (mode: 'graph' | 'table') => void
}) {
  return (
    <div className="flex rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm overflow-hidden shadow-sm">
      <button
        onClick={() => onViewModeChange('graph')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
          viewMode === 'graph'
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        }`}
      >
        <Cable className="h-3.5 w-3.5" />
        Graph
      </button>
      <button
        onClick={() => onViewModeChange('table')}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
          viewMode === 'table'
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        }`}
      >
        <Grid3X3 className="h-3.5 w-3.5" />
        Table
      </button>
    </div>
  )
}
