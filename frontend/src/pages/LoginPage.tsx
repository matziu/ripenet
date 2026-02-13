import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import apiClient from '@/api/client'
import { toast } from 'sonner'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  // Fetch CSRF cookie on mount
  useEffect(() => {
    apiClient.get('/auth/login/')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.login(username, password)
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      navigate(from, { replace: true })
    } catch {
      toast.error('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card text-card-foreground p-6 shadow-lg"
      >
        <h1 className="text-xl font-bold mb-1">RIPE-NET</h1>
        <p className="text-sm text-muted-foreground mb-6">IP Address Management</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  )
}
