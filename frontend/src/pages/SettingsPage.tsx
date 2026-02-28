import { useState, useRef } from 'react'
import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { backupApi, deviceTypesApi, portProfilesApi, usersApi, authApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { UserForm } from '@/components/data/forms/UserForm'
import {
  Settings, HardDrive, Users, Database, Download, Upload, Cpu,
  AlertTriangle, Trash2, Plus, Pencil, ChevronDown, ChevronRight, Dices, List,
} from 'lucide-react'
import type { DeviceTypeOption, PortProfile, PortTemplate, UserAdmin } from '@/types'

const PORT_TYPE_OPTIONS = ['rj45', 'sfp', 'sfp+', 'qsfp28', 'console'] as const

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#a855f7', // purple
  '#64748b', // slate
] as const

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const customRef = useRef<HTMLInputElement>(null)
  const isPreset = (PRESET_COLORS as readonly string[]).includes(value)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-5 h-5 rounded-sm border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            borderColor: value === c ? 'var(--foreground)' : 'transparent',
          }}
          title={c}
        />
      ))}
      <button
        type="button"
        onClick={() => customRef.current?.click()}
        className="relative w-5 h-5 rounded-sm border-2 transition-transform hover:scale-110 overflow-hidden"
        style={{
          background: isPreset
            ? 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)'
            : value,
          borderColor: !isPreset ? 'var(--foreground)' : 'transparent',
        }}
        title="Custom color"
      >
        <input
          ref={customRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </button>
    </div>
  )
}

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
        <NavLink to="/settings/port-profiles" className={navLinkClass}>
          <Cpu className="h-4 w-4" /> Port Profiles
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
          <Route path="port-profiles" element={<PortProfilesSection />} />
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
  const [newColor, setNewColor] = useState('#3b82f6')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('#3b82f6')
  const [showNewColorPicker, setShowNewColorPicker] = useState(false)

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
      setNewColor('#3b82f6')
      setShowNewColorPicker(false)
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
      color: newColor,
      position: (deviceTypes?.length ?? 0),
    })
  }

  const startEdit = (dt: DeviceTypeOption) => {
    setEditingId(dt.id)
    setEditLabel(dt.label)
    setEditColor(dt.color)
  }

  const saveEdit = (id: number) => {
    if (!editLabel.trim()) return
    updateMutation.mutate({ id, data: { label: editLabel.trim(), color: editColor } })
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
              <th className="px-3 py-1.5 text-left font-medium">Value</th>
              <th className="px-3 py-1.5 text-left font-medium">Label</th>
              <th className="px-3 py-1.5 text-left font-medium w-16">Color</th>
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
                editColor={editColor}
                onEditLabel={setEditLabel}
                onEditColor={setEditColor}
                onStartEdit={() => startEdit(dt)}
                onSaveEdit={() => saveEdit(dt.id)}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() => deleteMutation.mutate(dt.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex items-end gap-2">
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
            type="button"
            onClick={() => setShowNewColorPicker(!showNewColorPicker)}
            className="w-7 h-7 rounded-md border border-input shrink-0"
            style={{ backgroundColor: newColor }}
            title="Choose color"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newValue.trim() || !newLabel.trim()}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        {showNewColorPicker && (
          <ColorPicker value={newColor} onChange={setNewColor} />
        )}
      </form>
    </div>
  )
}

// ─── Device Type Row (with expandable port templates) ───────────────────────

interface DeviceTypeRowProps {
  dt: DeviceTypeOption
  editingId: number | null
  editLabel: string
  editColor: string
  onEditLabel: (v: string) => void
  onEditColor: (v: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}

function DeviceTypeRow({
  dt, editingId, editLabel, editColor,
  onEditLabel, onEditColor, onStartEdit, onSaveEdit, onCancelEdit, onDelete,
}: DeviceTypeRowProps) {
  const isEditing = editingId === dt.id
  return (
    <>
      <tr className={isEditing ? 'bg-accent/20' : 'border-b border-border last:border-0'}>
        <td className="px-3 py-1.5 font-mono text-muted-foreground">{dt.value}</td>
        <td className="px-3 py-1.5">
          {isEditing ? (
            <input
              value={editLabel}
              onChange={(e) => onEditLabel(e.target.value)}
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
          <div
            className="w-5 h-5 rounded border border-border/50"
            style={{ backgroundColor: isEditing ? editColor : dt.color }}
            title={isEditing ? editColor : dt.color}
          />
        </td>
        <td className="px-3 py-1.5">
          {isEditing ? (
            <div className="flex gap-0.5 justify-end">
              <button onClick={onSaveEdit} className="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground hover:bg-primary/90">
                Save
              </button>
              <button onClick={onCancelEdit} className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-accent">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-0.5 justify-end">
              <button onClick={onStartEdit} className="p-0.5 rounded hover:bg-accent" title="Edit">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button onClick={onDelete} className="p-0.5 rounded hover:bg-destructive/20" title="Delete device type">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </td>
      </tr>
      {isEditing && (
        <tr className="border-b border-border bg-accent/20">
          <td colSpan={4} className="px-3 py-2">
            <ColorPicker value={editColor} onChange={onEditColor} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Port Profiles Section ──────────────────────────────────────────────────

function generateSeriesFromPattern(
  pattern: string,
  start: number,
  end: number,
  step: number,
): string[] {
  const match = pattern.match(/\{(N+)\}/)
  if (!match) return []
  const padLen = match[1].length
  const results: string[] = []
  for (let i = start; i <= end; i += step) {
    const num = padLen > 1 ? String(i).padStart(padLen, '0') : String(i)
    results.push(pattern.replace(match[0], num))
  }
  return results
}

function PortProfilesSection() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: profiles } = useQuery({
    queryKey: ['port-profiles'],
    queryFn: () => portProfilesApi.list(),
    select: (res) => res.data,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<PortProfile>) => portProfilesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-profiles'] })
      setNewName('')
      setNewDesc('')
      toast.success('Port profile created')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to create profile')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PortProfile> }) =>
      portProfilesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-profiles'] })
      setEditingId(null)
      toast.success('Profile updated')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to update')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => portProfilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-profiles'] })
      toast.success('Profile deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Cannot delete profile')),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName.trim(), description: newDesc.trim() })
  }

  const startEdit = (p: PortProfile) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditDesc(p.description)
  }

  const saveEdit = (id: number) => {
    if (!editName.trim()) return
    updateMutation.mutate({ id, data: { name: editName.trim(), description: editDesc.trim() } })
  }

  return (
    <div className="max-w-3xl space-y-3">
      <h2 className="text-sm font-semibold">Port Profiles</h2>
      <p className="text-xs text-muted-foreground">
        Define reusable port profiles that can be applied to any host.
      </p>

      <div className="space-y-2">
        {profiles?.map((profile) => (
          <div key={profile.id} className="rounded-md border border-border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
              <button
                onClick={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
                className="flex items-center gap-2 text-sm font-medium"
              >
                {expandedId === profile.id
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                {editingId === profile.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => saveEdit(profile.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(profile.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                    className="rounded border border-input bg-background px-2 py-0.5 text-xs"
                  />
                ) : (
                  profile.name
                )}
                <span className="text-xs font-normal text-muted-foreground">
                  ({profile.entry_count} ports)
                </span>
              </button>
              <div className="flex gap-0.5">
                <button onClick={() => startEdit(profile)} className="p-0.5 rounded hover:bg-accent" title="Edit">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete profile "${profile.name}"?`)) deleteMutation.mutate(profile.id)
                  }}
                  className="p-0.5 rounded hover:bg-destructive/20"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
            {expandedId === profile.id && (
              <div className="px-3 py-3 border-t border-border">
                <PortEntriesPanel profileId={profile.id} />
              </div>
            )}
          </div>
        ))}
        {profiles?.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No port profiles defined.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Name</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Mikrotik CRS328"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Description</label>
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="optional"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !newName.trim()}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Profile
        </button>
      </form>
    </div>
  )
}

// ─── Port Entries Panel (inside a profile) ──────────────────────────────────

function PortEntriesPanel({ profileId }: { profileId: number }) {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newPortType, setNewPortType] = useState<string>('rj45')
  const [newPosition, setNewPosition] = useState('')

  const [showGenerator, setShowGenerator] = useState(false)
  const [genPattern, setGenPattern] = useState('')
  const [genPortType, setGenPortType] = useState('rj45')
  const [genStart, setGenStart] = useState('1')
  const [genEnd, setGenEnd] = useState('24')
  const [genStep, setGenStep] = useState('1')

  const { data: entries, isLoading } = useQuery({
    queryKey: ['port-entries', profileId],
    queryFn: () => portProfilesApi.entries.list(profileId),
    select: (res) => res.data,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<PortTemplate>) => portProfilesApi.entries.create(profileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-entries', profileId] })
      queryClient.invalidateQueries({ queryKey: ['port-profiles'] })
      setNewName('')
      setNewPosition('')
      toast.success('Port entry added')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to add entry')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => portProfilesApi.entries.delete(profileId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-entries', profileId] })
      queryClient.invalidateQueries({ queryKey: ['port-profiles'] })
      toast.success('Port entry deleted')
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to delete entry')),
  })

  const bulkMutation = useMutation({
    mutationFn: (tpls: Array<{ name: string; port_type: string }>) =>
      portProfilesApi.entries.bulkCreate(profileId, tpls),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['port-entries', profileId] })
      queryClient.invalidateQueries({ queryKey: ['port-profiles'] })
      setShowGenerator(false)
      setGenPattern('')
      toast.success(`Added ${res.data.length} port entries`)
    },
    onError: (err: unknown) => toast.error(extractApiError(err, 'Failed to create entries')),
  })

  const preview = genPattern.match(/\{N+\}/)
    ? generateSeriesFromPattern(
        genPattern,
        parseInt(genStart) || 0,
        parseInt(genEnd) || 0,
        Math.max(1, parseInt(genStep) || 1),
      )
    : []

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const pos = newPosition ? parseInt(newPosition, 10) : (entries?.length ?? 0) + 1
    createMutation.mutate({
      name: newName.trim(),
      port_type: newPortType,
      position: pos,
    })
  }

  return (
    <div className="space-y-2">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : entries && entries.length > 0 ? (
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
              {entries.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1 font-mono">{t.name}</td>
                  <td className="px-3 py-1 text-muted-foreground">{t.port_type}</td>
                  <td className="px-3 py-1 text-muted-foreground">{t.position}</td>
                  <td className="px-3 py-1">
                    <button
                      onClick={() => deleteMutation.mutate(t.id)}
                      className="p-0.5 rounded hover:bg-destructive/20"
                      title="Delete entry"
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
        <p className="text-xs text-muted-foreground italic">No port entries defined.</p>
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
              <label className="text-[10px] text-muted-foreground">{'Pattern (use {N}, {NN}, {NNN})'}</label>
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
