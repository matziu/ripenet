import { create } from 'zustand'

interface SelectionState {
  selectedProjectId: number | null
  selectedSiteId: number | null
  selectedVlanId: number | null
  selectedSubnetId: number | null
  selectedHostId: number | null
  expandedSiteIds: Set<number>
  expandedVlanIds: Set<number>
  expandedSubnetIds: Set<number>
  setSelectedProject: (id: number | null) => void
  setSelectedSite: (id: number | null) => void
  setSelectedVlan: (id: number | null) => void
  setSelectedSubnet: (id: number | null) => void
  setSelectedHost: (id: number | null) => void
  toggleExpandedSite: (id: number) => void
  toggleExpandedVlan: (id: number) => void
  toggleExpandedSubnet: (id: number) => void
  clearSelection: () => void
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedProjectId: null,
  selectedSiteId: null,
  selectedVlanId: null,
  selectedSubnetId: null,
  selectedHostId: null,
  expandedSiteIds: new Set(),
  expandedVlanIds: new Set(),
  expandedSubnetIds: new Set(),
  setSelectedProject: (id) => set({ selectedProjectId: id, selectedSiteId: null, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null }),
  setSelectedSite: (id) => set({ selectedSiteId: id, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null }),
  setSelectedVlan: (id) => set({ selectedVlanId: id, selectedSubnetId: null, selectedHostId: null }),
  setSelectedSubnet: (id) => set({ selectedSubnetId: id, selectedHostId: null }),
  setSelectedHost: (id) => set({ selectedHostId: id }),
  toggleExpandedSite: (id) => {
    const next = new Set(get().expandedSiteIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    set({ expandedSiteIds: next })
  },
  toggleExpandedVlan: (id) => {
    const next = new Set(get().expandedVlanIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    set({ expandedVlanIds: next })
  },
  toggleExpandedSubnet: (id) => {
    const next = new Set(get().expandedSubnetIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    set({ expandedSubnetIds: next })
  },
  clearSelection: () => set({ selectedProjectId: null, selectedSiteId: null, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null }),
}))
