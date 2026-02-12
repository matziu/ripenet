import type { TunnelType } from '@/types'

export interface WizardSite {
  tempId: string
  name: string
  address: string
}

export interface WizardVlanTemplate {
  tempId: string
  vlanId: number
  name: string
  purpose: string
  hostsNeeded: number
}

export interface WizardSiteOverride {
  skip?: boolean
  hostsNeeded?: number
}

export interface WizardAddressEntry {
  siteTempId: string
  vlanTempId: string
  subnet: string
  gateway: string
}

export interface WizardTunnelEntry {
  siteATempId: string
  siteBTempId: string
  tunnelSubnet: string
  ipA: string
  ipB: string
  name: string
}

export interface VLSMAllocation {
  name: string
  hosts_requested: number
  hosts_available: number
  subnet: string        // CIDR e.g. "10.0.0.0/25"
  error?: string        // set if allocation failed
}

export interface VLSMResult {
  parent: string
  allocations: VLSMAllocation[]
  remaining: string[]
}

export interface WizardState {
  // Step 1: Project
  projectMode: 'new' | 'existing'
  projectId?: number
  projectName: string
  projectDescription: string
  supernet: string

  // Step 2: Sites
  sites: WizardSite[]

  // Step 3: VLAN Template
  vlanTemplates: WizardVlanTemplate[]
  perSiteOverrides: Record<string, WizardSiteOverride[]>
  vlanNumbering: 'same' | 'per-site'
  vlanStartId: number
  vlanStep: number
  vlanSiteOffset: number      // per-site mode: offset between sites (e.g. 100)

  // Step 4: Address Plan
  addressingMode: 'vlsm' | 'vlan-aligned'
  vlanAlignedPrefix: number    // subnet prefix for vlan-aligned mode (default 24)
  vlsmResult?: VLSMResult
  addressPlan: WizardAddressEntry[]

  // Step 5: Tunnels
  tunnelMode: 'none' | 'full-mesh' | 'hub-spoke'
  tunnelType: TunnelType
  hubSiteTempId?: string
  tunnelSubnetBase: string
  tunnelPlan: WizardTunnelEntry[]
}

export const initialWizardState: WizardState = {
  projectMode: 'new',
  projectName: '',
  projectDescription: '',
  supernet: '',
  sites: [],
  vlanTemplates: [],
  perSiteOverrides: {},
  vlanNumbering: 'same',
  vlanStartId: 10,
  vlanStep: 10,
  vlanSiteOffset: 100,
  addressingMode: 'vlsm',
  vlanAlignedPrefix: 24,
  addressPlan: [],
  tunnelMode: 'none',
  tunnelType: 'wireguard',
  tunnelSubnetBase: '',
  tunnelPlan: [],
}
