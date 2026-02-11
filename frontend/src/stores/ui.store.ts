import { create } from 'zustand'

type ViewMode = 'topology' | 'geo' | 'table'

interface UIState {
  sidebarOpen: boolean
  detailPanelOpen: boolean
  viewMode: ViewMode
  darkMode: boolean
  commandPaletteOpen: boolean
  toggleSidebar: () => void
  toggleDetailPanel: () => void
  setViewMode: (mode: ViewMode) => void
  toggleDarkMode: () => void
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  detailPanelOpen: false,
  viewMode: 'topology',
  darkMode: localStorage.getItem('darkMode') === 'true',
  commandPaletteOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
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
