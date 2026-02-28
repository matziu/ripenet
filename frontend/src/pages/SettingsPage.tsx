import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backupApi, deviceTypesApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import { Download, Upload, AlertTriangle, Trash2, Plus, Pencil } from 'lucide-react'
import type { DeviceTypeOption } from '@/types'

export function SettingsPage() {
  const [replaceAll, setReplaceAll] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const downloadMutation = useMutation({
    mutationFn: () => backupApi.download(),
    onSuccess: (res) => {
      const blob = new Blob([res.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ripenet-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded')
    },
    onError: () => toast.error('Failed to download backup'),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, replace }: { file: File; replace: boolean }) =>
      backupApi.upload(file, replace),
    onSuccess: (res) => {
      toast.success(res.data.detail)
      setSelectedFile(null)
      setConfirmOpen(false)
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Import failed'
      toast.error(message)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file')
      return
    }
    setSelectedFile(file)
    setConfirmOpen(true)
  }

  const handleImport = () => {
    if (!selectedFile) return
    uploadMutation.mutate({ file: selectedFile, replace: replaceAll })
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8">
      <h1 className="text-lg font-semibold">Settings</h1>

      <DeviceTypesSection />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Data Backup</h2>
        <p className="text-xs text-muted-foreground">
          Download a full JSON snapshot of the database. The backup includes:
        </p>
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
          <li>Projects with settings and supernets</li>
          <li>Sites (names, addresses, coordinates)</li>
          <li>VLANs, subnets, gateways, descriptions</li>
          <li>Hosts (IP, hostname, MAC, device type, notes)</li>
          <li>DHCP pools (ranges, lease time, DNS/gateway)</li>
          <li>Tunnels (type, endpoints, subnet)</li>
          <li>User accounts (usernames, roles, emails)</li>
          <li>Audit log (all recorded changes)</li>
        </ul>
        <button
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloadMutation.isPending ? 'Downloading...' : 'Download backup'}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Restore Data</h2>
        <p className="text-xs text-muted-foreground">
          Import data from a previously downloaded backup file.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent/80 file:cursor-pointer"
        />

        {confirmOpen && selectedFile && (
          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-medium">Import "{selectedFile.name}"?</p>
                <p className="text-muted-foreground">
                  This will load data into the database. Existing records with the same IDs will be updated.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={replaceAll}
                onChange={(e) => setReplaceAll(e.target.checked)}
                className="rounded"
              />
              <span className="text-destructive font-medium">Replace all data</span>
              <span className="text-muted-foreground">— deletes everything before import</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadMutation.isPending ? 'Importing...' : 'Import'}
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false)
                  setSelectedFile(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}


function DeviceTypesSection() {
  const queryClient = useQueryClient()
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const { data: deviceTypes } = useQuery({
    queryKey: ['device-types'],
    queryFn: () => deviceTypesApi.list(),
    select: (res) => res.data,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<DeviceTypeOption>) => deviceTypesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-types'] })
      setNewValue('')
      setNewLabel('')
      toast.success('Device type added')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to add device type')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeviceTypeOption> }) =>
      deviceTypesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-types'] })
      setEditingId(null)
      toast.success('Device type updated')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to update')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deviceTypesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-types'] })
      toast.success('Device type deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot delete device type')),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newValue.trim() || !newLabel.trim()) return
    createMutation.mutate({
      value: newValue.trim(),
      label: newLabel.trim(),
      position: (deviceTypes?.length ?? 0),
    })
  }

  const startEdit = (dt: DeviceTypeOption) => {
    setEditingId(dt.id)
    setEditLabel(dt.label)
  }

  const saveEdit = (id: number) => {
    if (!editLabel.trim()) return
    updateMutation.mutate({ id, data: { label: editLabel.trim() } })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Device Types</h2>
      <p className="text-xs text-muted-foreground">
        Manage the list of device types available when creating hosts.
      </p>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-1.5 text-left font-medium">Value</th>
              <th className="px-3 py-1.5 text-left font-medium">Label</th>
              <th className="px-3 py-1.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {deviceTypes?.map((dt) => (
              <tr key={dt.id} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5 font-mono text-muted-foreground">{dt.value}</td>
                <td className="px-3 py-1.5">
                  {editingId === dt.id ? (
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={() => saveEdit(dt.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(dt.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="w-full rounded border border-input bg-background px-2 py-0.5 text-xs"
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(dt)}
                      className="cursor-pointer hover:text-primary"
                    >
                      {dt.label}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex gap-0.5 justify-end">
                    <button
                      onClick={() => startEdit(dt)}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Edit label"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(dt.id)}
                      className="p-0.5 rounded hover:bg-destructive/20"
                      title="Delete device type"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Value</label>
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="e.g. ups"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Label</label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. UPS"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !newValue.trim() || !newLabel.trim()}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>
    </section>
  )
}
