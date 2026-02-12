import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProjectPage } from '@/pages/ProjectPage'
import { ProjectsListPage } from '@/pages/ProjectsListPage'
import { LoginPage } from '@/pages/LoginPage'
import { WizardPage } from '@/pages/WizardPage'
import { CommandPalette } from '@/components/search/CommandPalette'
import { useUIStore } from '@/stores/ui.store'
import { authApi } from '@/api/endpoints'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    retry: false,
  })

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      navigate('/login', { state: { from: location }, replace: true })
    }
  }, [isLoading, isError, user, navigate, location])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (isError || !user) return null

  return <>{children}</>
}

function App() {
  const darkMode = useUIStore((s) => s.darkMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <>
      <CommandPalette />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/projects/:projectId/*" element={<ProjectPage />} />
          <Route path="/wizard" element={<WizardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
