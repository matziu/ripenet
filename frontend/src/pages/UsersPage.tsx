import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, authApi } from '@/api/endpoints'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { UserForm } from '@/components/data/forms/UserForm'
import { Plus, Pencil, Trash2, Dices } from 'lucide-react'
import type { UserAdmin } from '@/types'

function generatePassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

export function UsersPage() {
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
    <div className="p-3 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6 gap-2">
        <h1 className="text-xl md:text-2xl font-bold">Users</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-md bg-primary px-3 md:px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
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
          className="mb-6 rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Username"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="Email"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="First Name"
              value={newUser.first_name}
              onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Last Name"
              value={newUser.last_name}
              onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserAdmin['role'] })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
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
                className="shrink-0 rounded-md border border-border px-2.5 py-2 hover:bg-accent"
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
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 md:px-4 py-3 text-left font-medium">Username</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium">Email</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium">Role</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium hidden sm:table-cell">Name</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium">Active</th>
              <th className="px-3 md:px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-border hover:bg-accent/30">
                <td className="px-3 md:px-4 py-3 font-medium">{user.username}</td>
                <td className="px-3 md:px-4 py-3 text-muted-foreground">{user.email || '-'}</td>
                <td className="px-3 md:px-4 py-3">
                  <span className={
                    user.role === 'admin'
                      ? 'inline-block rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium'
                      : user.role === 'editor'
                        ? 'inline-block rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs font-medium'
                        : 'inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                  }>
                    {roleLabel(user.role)}
                  </span>
                </td>
                <td className="px-3 md:px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {[user.first_name, user.last_name].filter(Boolean).join(' ') || '-'}
                </td>
                <td className="px-3 md:px-4 py-3">
                  <span className={user.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                    {user.is_active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-3 md:px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditUser(user)}
                      className="p-1 rounded hover:bg-accent"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {(!me || user.id !== me.id) && (
                      <button
                        onClick={() => confirmDelete(user)}
                        className="p-1 rounded hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            )}
            {!isLoading && users?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No users found.
                </td>
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
