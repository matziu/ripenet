import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/endpoints'
import { toast } from 'sonner'
import { Dices } from 'lucide-react'
import type { UserAdmin } from '@/types'

function generatePassword(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

interface UserFormProps {
  user: UserAdmin
  onClose: () => void
}

export function UserForm({ user, onClose }: UserFormProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [firstName, setFirstName] = useState(user.first_name)
  const [lastName, setLastName] = useState(user.last_name)
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(user.is_active)

  const mutation = useMutation({
    mutationFn: (data: Partial<UserAdmin>) => usersApi.update(user.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
      onClose()
    },
    onError: () => toast.error('Failed to update user'),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data: Partial<UserAdmin> = {
          email,
          role,
          first_name: firstName,
          last_name: lastName,
          is_active: isActive,
        }
        if (password) data.password = password
        mutation.mutate(data)
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-xs font-medium">Username</label>
        <input
          value={user.username}
          disabled
          className="mt-1 w-full rounded-md border border-input bg-muted px-3 py-1.5 text-sm text-muted-foreground"
        />
      </div>
      <div>
        <label className="text-xs font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserAdmin['role'])}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">First Name</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Last Name</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium">Password</label>
        <div className="mt-1 flex gap-1.5">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty to keep current"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => {
              const pw = generatePassword()
              setPassword(pw)
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-input"
        />
        Active
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Update'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
