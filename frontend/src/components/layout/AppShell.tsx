import { useCallback, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { DetailPanel } from './DetailPanel'
import { useUIStore } from '@/stores/ui.store'

export function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const dragging = useRef(false)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      const startX = e.clientX
      const startW = sidebarWidth

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return
        setSidebarWidth(startW + (ev.clientX - startX))
      }

      const onMouseUp = () => {
        dragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [sidebarWidth, setSidebarWidth],
  )

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Sidebar: overlay on mobile, inline on desktop */}
        {sidebarOpen && (
          <>
            <Sidebar
              style={{ width: sidebarWidth }}
              className="max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:top-12 max-md:shadow-xl max-md:w-72!"
            />
            <div
              onMouseDown={onMouseDown}
              className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors hidden md:block"
            />
          </>
        )}

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* Detail panel: overlay on mobile, inline on desktop */}
        {detailPanelOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              onClick={toggleDetailPanel}
            />
            <DetailPanel className="max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:top-12 max-md:w-80 max-md:shadow-xl" />
          </>
        )}
      </div>
    </div>
  )
}
