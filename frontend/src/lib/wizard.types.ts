import type { TunnelType } from '@/types'

export interface WizardSite {
  tempId: string
  name: string
  address: string
  supernet: string
  latitude: number | null
  longitude: number | null
  wanAddresses: { ip_address: string; label: string }[]
  realId?: number
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
  name?: string
}

export interface WizardManualVlan {
  tempId: string
  vlanId: number
  name: string
  purpose: string
  hostsNeeded: number
  realId?: number
}

export interface VlanPreset {
  id: string
  name: string
  builtIn: boolean
  templates: Omit<WizardVlanTemplate, 'tempId'>[]
}

export interface SiteSummaryRoute {
  siteTempId: string
  summaryRoute: string
  subnetCount: number
  canSummarize: boolean
  message: string
}

export interface WizardAddressEntry {
  siteTempId: string
  vlanTempId: string
  subnet: string
  gateway: string
  realSubnetId?: number
  realVlanId?: number
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
  siteSupernetsEnabled: boolean

  // Step 3: VLAN Template
  vlanMode: 'template' | 'manual'
  vlanTemplates: WizardVlanTemplate[]
  perSiteOverrides: Record<string, WizardSiteOverride[]>
  perSiteVlans: Record<string, WizardManualVlan[]>
  vlanNumbering: 'same' | 'per-site'
  vlanStartId: number
  vlanStep: number
  vlanSiteOffset: number      // per-site mode: offset between sites (e.g. 100)

  // Step 4: Address Plan
  addressingMode: 'vlsm' | 'vlan-aligned' | 'site-in-octet' | 'sequential-fixed' | 'manual'
  perSiteAddressingMode: Record<string, 'vlsm' | 'vlan-aligned' | 'site-in-octet' | 'sequential-fixed' | 'manual'>
  vlanAlignedPrefix: number    // subnet prefix for vlan-aligned mode (default 24)
  sequentialFixedPrefix: number // subnet prefix for sequential-fixed mode (default 24)
  vlsmResult?: VLSMResult
  addressPlan: WizardAddressEntry[]

  // Step 5: Tunnels
  tunnelMode: 'none' | 'full-mesh' | 'hub-spoke' | 'manual'
  tunnelType: TunnelType
  hubSiteTempId?: string
  tunnelAllocMode: 'from-supernet' | 'separate' | 'manual'
  tunnelAllocStart: 'start' | 'end'
  tunnelPointToPointPrefix: 30 | 31
  tunnelSubnetBase: string
  tunnelPlan: WizardTunnelEntry[]
}

export const initialWizardState: WizardState = {
  projectMode: 'new',
  projectName: '',
  projectDescription: '',
  supernet: '',
  sites: [],
  siteSupernetsEnabled: false,
  vlanMode: 'template',
  vlanTemplates: [],
  perSiteOverrides: {},
  perSiteVlans: {},
  vlanNumbering: 'same',
  vlanStartId: 10,
  vlanStep: 10,
  vlanSiteOffset: 100,
  addressingMode: 'vlsm',
  perSiteAddressingMode: {},
  vlanAlignedPrefix: 24,
  sequentialFixedPrefix: 24,
  addressPlan: [],
  tunnelMode: 'none',
  tunnelType: 'wireguard',
  tunnelAllocMode: 'from-supernet',
  tunnelAllocStart: 'end',
  tunnelPointToPointPrefix: 30,
  tunnelSubnetBase: '',
  tunnelPlan: [],
}
