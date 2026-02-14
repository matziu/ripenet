import { create } from 'zustand'

type ViewMode = 'topology' | 'geo' | 'table'

interface UIState {
  sidebarOpen: boolean
  sidebarWidth: number
  detailPanelOpen: boolean
  viewMode: ViewMode
  darkMode: boolean
  commandPaletteOpen: boolean
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleDetailPanel: () => void
  setViewMode: (mode: ViewMode) => void
  toggleDarkMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: window.innerWidth >= 768,
  sidebarWidth: parseInt(localStorage.getItem('sidebarWidth') ?? '256', 10),
  detailPanelOpen: false,
  viewMode: 'topology',
  darkMode: localStorage.getItem('darkMode') === 'true',
  commandPaletteOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (width) => {
    const clamped = Math.max(200, Math.min(600, width))
    localStorage.setItem('sidebarWidth', String(clamped))
    set({ sidebarWidth: clamped })
  },
  toggleDetailPanel: () => set((s) => ({ detailPanelOpen: !s.detailPanelOpen })),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode
      localStorage.setItem('darkMode', String(next))
      document.documentElement.classList.toggle('dark', next)
      return { darkMode: next }
    }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}))
