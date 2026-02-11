import { create } from 'zustand'

interface SelectionState {
  selectedProjectId: number | null
  selectedSiteId: number | null
  selectedVlanId: number | null
  selectedSubnetId: number | null
  selectedHostId: number | null
  setSelectedProject: (id: number | null) => void
  setSelectedSite: (id: number | null) => void
  setSelectedVlan: (id: number | null) => void
  setSelectedSubnet: (id: number | null) => void
  setSelectedHost: (id: number | null) => void
  clearSelection: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedProjectId: null,
  selectedSiteId: null,
  selectedVlanId: null,
  selectedSubnetId: null,
  selectedHostId: null,
  setSelectedProject: (id) => set({ selectedProjectId: id, selectedSiteId: null, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null }),
  setSelectedSite: (id) => set({ selectedSiteId: id, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null }),
  setSelectedVlan: (id) => set({ selectedVlanId: id, selectedSubnetId: null, selectedHostId: null }),
  setSelectedSubnet: (id) => set({ selectedSubnetId: id, selectedHostId: null }),
  setSelectedHost: (id) => set({ selectedHostId: id }),
  clearSelection: () => set({ selectedProjectId: null, selectedSiteId: null, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null }),
}))
