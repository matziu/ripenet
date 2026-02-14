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
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
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
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <>
            <Sidebar style={{ width: sidebarWidth }} />
            <div
              onMouseDown={onMouseDown}
              className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors"
            />
          </>
        )}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        {detailPanelOpen && <DetailPanel />}
      </div>
    </div>
  )
}
