import { useState, useRef } from 'react'
import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backupApi, deviceTypesApi, portTemplatesApi, usersApi, authApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { UserForm } from '@/components/data/forms/UserForm'
import {
  Settings, HardDrive, Users, Database, Download, Upload,
  AlertTriangle, Trash2, Plus, Pencil, ChevronDown, ChevronRight, Zap, Dices,
} from 'lucide-react'
import type { DeviceTypeOption, PortTemplate, UserAdmin } from '@/types'

const PORT_TYPE_OPTIONS = ['rj45', 'sfp', 'sfp+', 'qsfp28', 'console'] as const

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/50'
  }`
}

// ─── Main Layout ────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <div className="flex h-full">
      <nav className="w-48 shrink-0 border-r border-border p-3 space-y-1">
        <NavLink to="/settings/general" className={navLinkClass}>
          <Settings className="h-4 w-4" /> General
        </NavLink>
        <NavLink to="/settings/device-types" className={navLinkClass}>
          <HardDrive className="h-4 w-4" /> Device Types
        </NavLink>
        <NavLink to="/settings/users" className={navLinkClass}>
          <Users className="h-4 w-4" /> Users
        </NavLink>
        <NavLink to="/settings/backup" className={navLinkClass}>
          <Database className="h-4 w-4" /> Backup
        </NavLink>
      </nav>

      <div className="flex-1 overflow-auto p-6">
        <Routes>
          <Route index element={<Navigate to="device-types" replace />} />
          <Route path="general" element={<GeneralSection />} />
          <Route path="device-types" element={<DeviceTypesSection />} />
          <Route path="users" element={<UsersSection />} />
          <Route path="backup" element={<BackupSection />} />
        </Routes>
      </div>
    </div>
  )
}

// ─── General ────────────────────────────────────────────────────────────────

function GeneralSection() {
  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-sm font-semibold">General</h2>
      <div className="rounded-md border border-border p-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Application</span>
          <span>RIPE-NET IPAM</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Version</span>
          <span className="font-mono">1.2.0</span>
        </div>
      </div>
    </div>
  )
}

// ─── Users ──────────────────────────────────────────────────────────────────

function generatePassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

function UsersSection() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({
    username: '', email: '', role: 'viewer' as UserAdmin['role'],
    first_name: '', last_name: '', password: '',
  })
  const [editUser, setEditUser] = useState<UserAdmin | null>(null)

  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    select: (res) => res.data,
  })

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    select: (res) => res.data.results,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<UserAdmin>) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created')
      setShowCreate(false)
      setNewUser({ username: '', email: '', role: 'viewer', first_name: '', last_name: '', password: '' })
    },
    onError: () => toast.error('Failed to create user'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted')
    },
    onError: () => toast.error('Failed to delete user'),
  })

  const confirmDelete = (user: UserAdmin) => {
    if (me && user.id === me.id) {
      toast.error('You cannot delete your own account')
      return
    }
    if (window.confirm(`Delete user "${user.username}"?`)) {
      deleteMutation.mutate(user.id)
    }
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin'
      case 'editor': return 'Editor'
      case 'viewer': return 'Viewer'
      default: return role
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Users</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add User
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate({
              username: newUser.username,
              email: newUser.email,
              role: newUser.role,
              first_name: newUser.first_name,
              last_name: newUser.last_name,
              password: newUser.password,
            })
          }}
          className="rounded-md border border-border p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Username"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              required
            />
            <input
              placeholder="Email"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <input
              placeholder="First Name"
              value={newUser.first_name}
              onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <input
              placeholder="Last Name"
              value={newUser.last_name}
              onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserAdmin['role'] })}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-1.5">
              <input
                placeholder="Password"
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                required
              />
              <button
                type="button"
                onClick={() => {
                  const pw = generatePassword()
                  setNewUser({ ...newUser, password: pw })
                  navigator.clipboard.writeText(pw)
                  toast.success('Password generated & copied')
                }}
                className="shrink-0 rounded-md border border-border px-2 py-1.5 hover:bg-accent"
                title="Generate password"
              >
                <Dices className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Username</th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-left font-medium">Role</th>
              <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Name</th>
              <th className="px-3 py-2 text-left font-medium">Active</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-3 py-2 font-medium">{user.username}</td>
                <td className="px-3 py-2 text-muted-foreground">{user.email || '-'}</td>
                <td className="px-3 py-2">
                  <span className={
                    user.role === 'admin'
                      ? 'inline-block rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium'
                      : user.role === 'editor'
                        ? 'inline-block rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-medium'
                        : 'inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'
                  }>
                    {roleLabel(user.role)}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                  {[user.first_name, user.last_name].filter(Boolean).join(' ') || '-'}
                </td>
                <td className="px-3 py-2">
                  <span className={user.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                    {user.is_active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-0.5">
                    <button
                      onClick={() => setEditUser(user)}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {(!me || user.id !== me.id) && (
                      <button
                        onClick={() => confirmDelete(user)}
                        className="p-0.5 rounded hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading...</td>
              </tr>
            )}
            {!isLoading && users?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!editUser}
        onOpenChange={(open) => { if (!open) setEditUser(null) }}
        title="Edit User"
      >
        {editUser && (
          <UserForm user={editUser} onClose={() => setEditUser(null)} />
        )}
      </Dialog>
    </div>
  )
}

// ─── Device Types + Port Templates ──────────────────────────────────────────

function DeviceTypesSection() {
  const queryClient = useQueryClient()
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

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

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-sm font-semibold">Device Types</h2>
      <p className="text-xs text-muted-foreground">
        Manage the list of device types available when creating hosts.
      </p>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-1.5 w-8" />
              <th className="px-3 py-1.5 text-left font-medium">Value</th>
              <th className="px-3 py-1.5 text-left font-medium">Label</th>
              <th className="px-3 py-1.5 w-20" />
            </tr>
          </thead>
          <tbody>
            {deviceTypes?.map((dt) => (
              <DeviceTypeRow
                key={dt.id}
                dt={dt}
                editingId={editingId}
                editLabel={editLabel}
                expanded={expandedId === dt.id}
                onToggleExpand={() => toggleExpand(dt.id)}
                onEditLabel={setEditLabel}
                onStartEdit={() => startEdit(dt)}
                onSaveEdit={() => saveEdit(dt.id)}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() => deleteMutation.mutate(dt.id)}
              />
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
    </div>
  )
}

// ─── Device Type Row (with expandable port templates) ───────────────────────

interface DeviceTypeRowProps {
  dt: DeviceTypeOption
  editingId: number | null
  editLabel: string
  expanded: boolean
  onToggleExpand: () => void
  onEditLabel: (v: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}

function DeviceTypeRow({
  dt, editingId, editLabel, expanded,
  onToggleExpand, onEditLabel, onStartEdit, onSaveEdit, onCancelEdit, onDelete,
}: DeviceTypeRowProps) {
  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-3 py-1.5">
          <button
            onClick={onToggleExpand}
            className="p-0.5 rounded hover:bg-accent"
            title="Toggle port templates"
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </td>
        <td className="px-3 py-1.5 font-mono text-muted-foreground">{dt.value}</td>
        <td className="px-3 py-1.5">
          {editingId === dt.id ? (
            <input
              value={editLabel}
              onChange={(e) => onEditLabel(e.target.value)}
              onBlur={onSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit()
                if (e.key === 'Escape') onCancelEdit()
              }}
              autoFocus
              className="w-full rounded border border-input bg-background px-2 py-0.5 text-xs"
            />
          ) : (
            <span onClick={onStartEdit} className="cursor-pointer hover:text-primary">
              {dt.label}
            </span>
          )}
        </td>
        <td className="px-3 py-1.5">
          <div className="flex gap-0.5 justify-end">
            <button onClick={onStartEdit} className="p-0.5 rounded hover:bg-accent" title="Edit label">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={onDelete} className="p-0.5 rounded hover:bg-destructive/20" title="Delete device type">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="bg-muted/30 px-4 py-3">
            <PortTemplatesPanel deviceTypeId={dt.id} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Port Templates Panel ───────────────────────────────────────────────────

function PortTemplatesPanel({ deviceTypeId }: { deviceTypeId: number }) {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newPortType, setNewPortType] = useState<string>('rj45')
  const [newPosition, setNewPosition] = useState('')

  const { data: templates, isLoading } = useQuery({
    queryKey: ['port-templates', deviceTypeId],
    queryFn: () => portTemplatesApi.list(deviceTypeId),
    select: (res) => res.data,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<PortTemplate>) => portTemplatesApi.create(deviceTypeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-templates', deviceTypeId] })
      setNewName('')
      setNewPosition('')
      toast.success('Port template added')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to add template')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => portTemplatesApi.delete(deviceTypeId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-templates', deviceTypeId] })
      toast.success('Port template deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to delete template')),
  })

  const applyMutation = useMutation({
    mutationFn: () => portTemplatesApi.apply(deviceTypeId),
    onSuccess: (res) => toast.success(res.data.detail),
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to apply templates')),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const pos = newPosition ? parseInt(newPosition, 10) : (templates?.length ?? 0) + 1
    createMutation.mutate({
      name: newName.trim(),
      port_type: newPortType,
      position: pos,
    })
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">Port Templates</h3>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : templates && templates.length > 0 ? (
        <div className="rounded-md border border-border overflow-hidden bg-background">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-1 text-left font-medium">Name</th>
                <th className="px-3 py-1 text-left font-medium">Type</th>
                <th className="px-3 py-1 text-left font-medium">Position</th>
                <th className="px-3 py-1 w-10" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1 font-mono">{t.name}</td>
                  <td className="px-3 py-1 text-muted-foreground">{t.port_type}</td>
                  <td className="px-3 py-1 text-muted-foreground">{t.position}</td>
                  <td className="px-3 py-1">
                    <button
                      onClick={() => deleteMutation.mutate(t.id)}
                      className="p-0.5 rounded hover:bg-destructive/20"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No port templates defined.</p>
      )}

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. GE0/0/1"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
          />
        </div>
        <div className="w-28">
          <label className="text-[10px] text-muted-foreground">Type</label>
          <select
            value={newPortType}
            onChange={(e) => setNewPortType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {PORT_TYPE_OPTIONS.map((pt) => (
              <option key={pt} value={pt}>{pt}</option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label className="text-[10px] text-muted-foreground">Position</label>
          <input
            value={newPosition}
            onChange={(e) => setNewPosition(e.target.value.replace(/\D/g, ''))}
            placeholder="auto"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !newName.trim()}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>

      <button
        onClick={() => applyMutation.mutate()}
        disabled={applyMutation.isPending || !templates?.length}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
      >
        <Zap className="h-3.5 w-3.5" />
        {applyMutation.isPending ? 'Applying...' : 'Apply to existing hosts'}
      </button>
    </div>
  )
}

// ─── Backup ─────────────────────────────────────────────────────────────────

function BackupSection() {
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
    <div className="max-w-xl space-y-8">
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
              <span className="text-muted-foreground">-- deletes everything before import</span>
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
