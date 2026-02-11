import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { DetailPanel } from './DetailPanel'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'

export function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className={cn('transition-all duration-200', sidebarOpen ? 'w-64' : 'w-0')} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        {detailPanelOpen && <DetailPanel />}
      </div>
    </div>
  )
}
