import { create } from 'zustand'

interface SelectionState {
  selectedProjectId: number | null
  selectedSiteId: number | null
  selectedVlanId: number | null
  selectedSubnetId: number | null
  selectedHostId: number | null
  selectedTunnelId: number | null
  expandedProjectIds: Set<number>
  expandedSiteIds: Set<number>
  expandedVlanIds: Set<number>
  expandedSubnetIds: Set<number>
  toggleExpandedProject: (id: number) => void
  setSelectedProject: (id: number | null) => void
  setSelectedSite: (id: number | null) => void
  setSelectedVlan: (id: number | null) => void
  setSelectedSubnet: (id: number | null) => void
  setSelectedHost: (id: number | null) => void
  setSelectedTunnel: (id: number | null) => void
  toggleExpandedSite: (id: number) => void
  toggleExpandedVlan: (id: number) => void
  toggleExpandedSubnet: (id: number) => void
  expandAll: (projectIds: number[], siteIds: number[], vlanIds: number[], subnetIds: number[]) => void
  collapseAll: () => void
  clearSelection: () => void
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedProjectId: null,
  selectedSiteId: null,
  selectedVlanId: null,
  selectedSubnetId: null,
  selectedHostId: null,
  selectedTunnelId: null,
  expandedProjectIds: new Set(),
  expandedSiteIds: new Set(),
  expandedVlanIds: new Set(),
  expandedSubnetIds: new Set(),
  toggleExpandedProject: (id) => {
    const next = new Set(get().expandedProjectIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    set({ expandedProjectIds: next })
  },
  setSelectedProject: (id) => set({ selectedProjectId: id, selectedSiteId: null, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null, selectedTunnelId: null }),
  setSelectedSite: (id) => set({ selectedSiteId: id, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null, selectedTunnelId: null }),
  setSelectedVlan: (id) => set({ selectedVlanId: id, selectedSubnetId: null, selectedHostId: null, selectedTunnelId: null }),
  setSelectedSubnet: (id) => set({ selectedSubnetId: id, selectedHostId: null, selectedTunnelId: null }),
  setSelectedHost: (id) => set({ selectedHostId: id, selectedTunnelId: null }),
  setSelectedTunnel: (id) => set({ selectedTunnelId: id, selectedSiteId: null, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null }),
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
  expandAll: (projectIds, siteIds, vlanIds, subnetIds) => set({
    expandedProjectIds: new Set(projectIds),
    expandedSiteIds: new Set(siteIds),
    expandedVlanIds: new Set(vlanIds),
    expandedSubnetIds: new Set(subnetIds),
  }),
  collapseAll: () => set({
    expandedProjectIds: new Set(),
    expandedSiteIds: new Set(),
    expandedVlanIds: new Set(),
    expandedSubnetIds: new Set(),
  }),
  clearSelection: () => set({ selectedProjectId: null, selectedSiteId: null, selectedVlanId: null, selectedSubnetId: null, selectedHostId: null, selectedTunnelId: null }),
}))
