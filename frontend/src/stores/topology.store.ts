import { create } from 'zustand'

interface TopologyState {
  selectedSiteId: number | null
  expandedSites: Set<number>
  selectedVlanId: number | null
  highlightedNodeId: string | null
  setSelectedSite: (id: number | null) => void
  toggleExpandedSite: (id: number) => void
  setSelectedVlan: (id: number | null) => void
  setHighlightedNode: (id: string | null) => void
}

export const useTopologyStore = create<TopologyState>((set) => ({
  selectedSiteId: null,
  expandedSites: new Set(),
  selectedVlanId: null,
  highlightedNodeId: null,
  setSelectedSite: (id) => set({ selectedSiteId: id }),
  toggleExpandedSite: (id) =>
    set((s) => {
      const next = new Set(s.expandedSites)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { expandedSites: next }
    }),
  setSelectedVlan: (id) => set({ selectedVlanId: id, detailPanelOpen: true } as never),
  setHighlightedNode: (id) => set({ highlightedNodeId: id }),
}))
