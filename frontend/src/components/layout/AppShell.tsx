import { useCallback, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { DetailPanel } from './DetailPanel'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'

export function AppShell() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const detailPanelWidth = useUIStore((s) => s.detailPanelWidth)
  const setDetailPanelWidth = useUIStore((s) => s.setDetailPanelWidth)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const draggingSidebar = useRef(false)
  const draggingDetail = useRef(false)

  // ── Left sidebar drag ──
  const onSidebarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingSidebar.current = true
      const startX = e.clientX
      const startW = sidebarWidth

      const onMouseMove = (ev: MouseEvent) => {
        if (!draggingSidebar.current) return
        setSidebarWidth(startW + (ev.clientX - startX))
      }

      const onMouseUp = () => {
        draggingSidebar.current = false
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

  const onSidebarTouchStart = useCallback(
    (e: React.TouchEvent) => {
      draggingSidebar.current = true
      const startX = e.touches[0].clientX
      const startW = sidebarWidth

      const onTouchMove = (ev: TouchEvent) => {
        if (!draggingSidebar.current) return
        setSidebarWidth(startW + (ev.touches[0].clientX - startX))
      }

      const onTouchEnd = () => {
        draggingSidebar.current = false
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onTouchEnd)
      }

      document.addEventListener('touchmove', onTouchMove, { passive: true })
      document.addEventListener('touchend', onTouchEnd)
    },
    [sidebarWidth, setSidebarWidth],
  )

  // ── Right detail panel drag ──
  const onDetailMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingDetail.current = true
      const startX = e.clientX
      const startW = detailPanelWidth

      const onMouseMove = (ev: MouseEvent) => {
        if (!draggingDetail.current) return
        setDetailPanelWidth(startW - (ev.clientX - startX))
      }

      const onMouseUp = () => {
        draggingDetail.current = false
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
    [detailPanelWidth, setDetailPanelWidth],
  )

  const onDetailTouchStart = useCallback(
    (e: React.TouchEvent) => {
      draggingDetail.current = true
      const startX = e.touches[0].clientX
      const startW = detailPanelWidth

      const onTouchMove = (ev: TouchEvent) => {
        if (!draggingDetail.current) return
        setDetailPanelWidth(startW - (ev.touches[0].clientX - startX))
      }

      const onTouchEnd = () => {
        draggingDetail.current = false
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onTouchEnd)
      }

      document.addEventListener('touchmove', onTouchMove, { passive: true })
      document.addEventListener('touchend', onTouchEnd)
    },
    [detailPanelWidth, setDetailPanelWidth],
  )

  const isDragging = draggingSidebar.current || draggingDetail.current

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Mobile overlay backdrops ── */}
        <div
          className={cn(
            'fixed inset-0 z-30 bg-black/40 md:hidden transition-opacity duration-300',
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          onClick={toggleSidebar}
        />

        {/* ── Left Sidebar (Desktop) — width transition ── */}
        <div
          className="shrink-0 overflow-hidden hidden md:flex"
          style={{
            width: sidebarOpen ? sidebarWidth + 4 : 0,
            transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Sidebar style={{ width: sidebarWidth, minWidth: sidebarWidth }} />
          <div
            onMouseDown={onSidebarMouseDown}
            onTouchStart={onSidebarTouchStart}
            className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors touch-none"
          />
        </div>

        {/* ── Left Sidebar (Mobile) — slide transition ── */}
        <Sidebar
          className={cn(
            'fixed inset-y-0 left-0 z-40 top-12 w-72 shadow-xl md:hidden',
            'transition-transform duration-300 ease-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        />

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* ── Right Detail Panel backdrop (Mobile) ── */}
        <div
          className={cn(
            'fixed inset-0 z-30 bg-black/40 md:hidden transition-opacity duration-300',
            detailPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
          onClick={toggleDetailPanel}
        />

        {/* ── Right Detail Panel (Desktop) — width transition ── */}
        <div
          className="shrink-0 overflow-hidden hidden md:flex"
          style={{
            width: detailPanelOpen ? detailPanelWidth + 4 : 0,
            transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            onMouseDown={onDetailMouseDown}
            onTouchStart={onDetailTouchStart}
            className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors touch-none"
          />
          <DetailPanel style={{ width: detailPanelWidth, minWidth: detailPanelWidth }} />
        </div>

        {/* ── Right Detail Panel (Mobile) — slide transition ── */}
        <DetailPanel
          className={cn(
            'fixed inset-y-0 right-0 z-40 top-12 w-80 shadow-xl md:hidden',
            'transition-transform duration-300 ease-out',
            detailPanelOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        />
      </div>
    </div>
  )
}
