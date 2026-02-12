import { useUIStore } from '@/stores/ui.store'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Search, Moon, Sun, PanelLeftClose, PanelLeft,
  Network, Map, Table,
} from 'lucide-react'

export function TopBar() {
  const {
    sidebarOpen, toggleSidebar,
    darkMode, toggleDarkMode, setCommandPaletteOpen,
  } = useUIStore()
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()

  // Derive active view from URL
  const pathAfterProject = projectId
    ? location.pathname.split(`/projects/${projectId}/`)[1] ?? ''
    : ''
  const activeView = pathAfterProject.startsWith('geo')
    ? 'geo'
    : pathAfterProject.startsWith('table')
      ? 'table'
      : 'topology'

  const viewButtons: { mode: 'topology' | 'geo' | 'table'; icon: typeof Network; label: string }[] = [
    { mode: 'topology', icon: Network, label: 'Topology' },
    { mode: 'geo', icon: Map, label: 'Geo Map' },
    { mode: 'table', icon: Table, label: 'Table' },
  ]

  const handleViewChange = (mode: 'topology' | 'geo' | 'table') => {
    if (!projectId) return
    if (mode === 'table') {
      navigate(`/projects/${projectId}/table/hosts`)
    } else {
      navigate(`/projects/${projectId}/${mode}`)
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="p-1.5 rounded-md hover:bg-accent" title="Toggle sidebar">
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>
        <span className="font-semibold text-sm tracking-tight">RIPE-NET</span>
      </div>

      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors min-w-[240px]"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">
          Ctrl+K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        {projectId && (
          <div className="flex items-center rounded-md border border-border p-0.5 mr-2">
            {viewButtons.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => handleViewChange(mode)}
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                  activeView === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        )}

        <button onClick={toggleDarkMode} className="p-1.5 rounded-md hover:bg-accent" title="Toggle dark mode">
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  )
}
