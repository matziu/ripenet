import type {
  WizardState,
  WizardTunnelEntry,
  WizardAddressEntry,
  VLSMResult,
  VLSMAllocation,
  VlanPreset,
  SiteSummaryRoute,
} from './wizard.types'

/** Compute the effective VLAN ID for a given template at a given site index */
export function getVlanIdForSite(
  baseVlanId: number,
  siteIndex: number,
  state: WizardState,
): number {
  if (state.vlanNumbering === 'same') return baseVlanId
  return baseVlanId + siteIndex * state.vlanSiteOffset
}

/** Build the VLSM requirements array from sites + templates + overrides */
export function buildVlsmRequirements(state: WizardState) {
  const requirements: { name: string; hosts: number }[] = []

  for (const site of state.sites) {
    const overrides = state.perSiteOverrides[site.tempId] ?? []
    for (let i = 0; i < state.vlanTemplates.length; i++) {
      const tpl = state.vlanTemplates[i]
      const override = overrides[i]
      if (override?.skip) continue
      requirements.push({
        name: `${site.name} - ${tpl.name}`,
        hosts: override?.hostsNeeded ?? tpl.hostsNeeded,
      })
    }
  }

  return requirements
}

/** Map VLSM result allocations back to site+vlan entries (matched by name) */
export function buildAddressPlan(
  state: WizardState,
  vlsmResult: VLSMResult,
): WizardAddressEntry[] {
  // Build a lookup by name since backend sorts allocations by size
  const allocByName = new Map<string, VLSMAllocation>()
  for (const alloc of vlsmResult.allocations) {
    allocByName.set(alloc.name, alloc)
  }

  const plan: WizardAddressEntry[] = []

  for (const site of state.sites) {
    const overrides = state.perSiteOverrides[site.tempId] ?? []
    for (let i = 0; i < state.vlanTemplates.length; i++) {
      const tpl = state.vlanTemplates[i]
      const override = overrides[i]
      if (override?.skip) continue

      const name = `${site.name} - ${tpl.name}`
      const alloc = allocByName.get(name)
      if (!alloc || !alloc.subnet) continue
      plan.push({
        siteTempId: site.tempId,
        vlanTempId: tpl.tempId,
        subnet: alloc.subnet,
        gateway: computeGateway(alloc.subnet),
      })
    }
  }

  return plan
}

/**
 * Build address plan using VLAN-aligned addressing.
 * Each site gets a /16 block from the supernet.
 * VLAN ID maps to the 3rd octet → e.g. VLAN 100 = x.x.100.0/24
 */
export function buildVlanAlignedPlan(state: WizardState): WizardAddressEntry[] {
  const [ipStr] = state.supernet.split('/')
  const parts = ipStr.split('.').map(Number)
  const baseNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  // Align to /16 boundary
  const base16 = baseNum & 0xffff0000
  const subnetPrefix = state.vlanAlignedPrefix
  const perSite = state.vlanNumbering === 'per-site'

  const plan: WizardAddressEntry[] = []

  for (let siteIdx = 0; siteIdx < state.sites.length; siteIdx++) {
    const site = state.sites[siteIdx]
    const overrides = state.perSiteOverrides[site.tempId] ?? []

    // Per-site unique VLAN IDs: all sites share the same /16 (IDs don't collide)
    // Same VLAN IDs: each site gets a separate /16 block
    const siteBaseNum = perSite ? base16 : (base16 + (siteIdx << 16)) >>> 0

    for (let i = 0; i < state.vlanTemplates.length; i++) {
      const tpl = state.vlanTemplates[i]
      const override = overrides[i]
      if (override?.skip) continue

      // Use per-site VLAN ID in 3rd octet
      const effectiveVlanId = getVlanIdForSite(tpl.vlanId, siteIdx, state)
      const subnetNum = ((siteBaseNum & 0xffff0000) | ((effectiveVlanId & 0xff) << 8)) >>> 0
      const subnet = numToIp(subnetNum) + '/' + subnetPrefix
      plan.push({
        siteTempId: site.tempId,
        vlanTempId: tpl.tempId,
        subnet,
        gateway: computeGateway(subnet),
      })
    }
  }

  return plan
}

/** Validate VLAN-aligned mode constraints. Returns error messages or empty array. */
export function validateVlanAligned(state: WizardState): string[] {
  const errors: string[] = []
  if (!state.supernet.includes('/')) return ['Invalid supernet']
  const prefix = parseInt(state.supernet.split('/')[1], 10)
  const perSite = state.vlanNumbering === 'per-site'

  if (prefix > 16) {
    errors.push('VLAN-aligned mode requires a supernet of /16 or larger')
  }

  if (!perSite) {
    // Same VLAN IDs: each site needs its own /16 block
    const available16Blocks = prefix <= 16 ? 1 << (16 - prefix) : 0
    if (state.sites.length > available16Blocks) {
      errors.push(
        `With same VLAN IDs per site, supernet /${prefix} provides ${available16Blocks} /16 block(s), but ${state.sites.length} sites are defined. Use a larger supernet or switch to unique-per-site numbering.`,
      )
    }
  }

  // Check all effective VLAN IDs fit in a single octet (0–255)
  const usedOctets = new Set<number>()
  for (let siteIdx = 0; siteIdx < state.sites.length; siteIdx++) {
    for (const tpl of state.vlanTemplates) {
      const vid = getVlanIdForSite(tpl.vlanId, siteIdx, state)
      if (vid > 255 || vid < 0) {
        errors.push(
          `VLAN IDs must be 0–255 for 3rd-octet mapping. VLAN ${tpl.vlanId} at site ${siteIdx + 1} resolves to ${vid}`,
        )
        return errors
      }
      if (perSite && usedOctets.has(vid)) {
        errors.push(
          `Duplicate 3rd-octet value ${vid} across sites. Adjust VLAN IDs or site offset to avoid collisions.`,
        )
        return errors
      }
      usedOctets.add(vid)
    }
  }

  return errors
}

/** Compute full subnet details from a CIDR string */
export function computeSubnetDetails(cidr: string) {
  const [ip, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  const parts = ip.split('.').map(Number)
  const netNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  const hostBits = 32 - prefix
  const broadcastNum = (netNum | ((1 << hostBits) - 1)) >>> 0

  if (prefix >= 31) {
    return {
      gateway: numToIp(netNum),
      hostMin: numToIp(netNum),
      hostMax: numToIp(broadcastNum),
      broadcast: numToIp(broadcastNum),
    }
  }

  return {
    gateway: numToIp(netNum + 1),
    hostMin: numToIp(netNum + 2),
    hostMax: numToIp(broadcastNum - 1),
    broadcast: numToIp(broadcastNum),
  }
}

/** Compute the first usable IP (gateway) from a CIDR */
export function computeGateway(cidr: string): string {
  return computeSubnetDetails(cidr).gateway
}

/** Generate full-mesh tunnel pairs between all sites */
export function generateFullMeshTunnels(
  sites: WizardState['sites'],
  tunnelSubnetBase: string,
  tunnelType: string,
): WizardTunnelEntry[] {
  const pairs: WizardTunnelEntry[] = []
  const thirtySlots = generateSlash30s(tunnelSubnetBase)
  let slotIdx = 0

  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const slot = thirtySlots[slotIdx]
      if (!slot) break
      pairs.push({
        siteATempId: sites[i].tempId,
        siteBTempId: sites[j].tempId,
        tunnelSubnet: slot.subnet,
        ipA: slot.ipA,
        ipB: slot.ipB,
        name: `${tunnelType}-${sites[i].name}-${sites[j].name}`,
      })
      slotIdx++
    }
  }

  return pairs
}

/** Generate hub-spoke tunnel pairs */
export function generateHubSpokeTunnels(
  sites: WizardState['sites'],
  hubTempId: string,
  tunnelSubnetBase: string,
  tunnelType: string,
): WizardTunnelEntry[] {
  const pairs: WizardTunnelEntry[] = []
  const thirtySlots = generateSlash30s(tunnelSubnetBase)
  const hub = sites.find((s) => s.tempId === hubTempId)
  if (!hub) return pairs

  let slotIdx = 0
  for (const site of sites) {
    if (site.tempId === hubTempId) continue
    const slot = thirtySlots[slotIdx]
    if (!slot) break
    pairs.push({
      siteATempId: hub.tempId,
      siteBTempId: site.tempId,
      tunnelSubnet: slot.subnet,
      ipA: slot.ipA,
      ipB: slot.ipB,
      name: `${tunnelType}-${hub.name}-${site.name}`,
    })
    slotIdx++
  }

  return pairs
}

/** Split a CIDR block into /30 subnets for point-to-point links */
function generateSlash30s(cidr: string): { subnet: string; ipA: string; ipB: string }[] {
  if (!cidr || !cidr.includes('/')) return []

  const [ip, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  if (prefix > 30) return []

  const parts = ip.split('.').map(Number)
  const baseNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  const totalAddresses = 1 << (32 - prefix)
  const slots: { subnet: string; ipA: string; ipB: string }[] = []

  for (let offset = 0; offset < totalAddresses; offset += 4) {
    const netNum = baseNum + offset
    slots.push({
      subnet: numToIp(netNum) + '/30',
      ipA: numToIp(netNum + 1),
      ipB: numToIp(netNum + 2),
    })
  }

  return slots
}

function numToIp(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.')
}

/** Generate a unique temp ID */
export function tempId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ---------------------------------------------------------------------------
// VLAN Template Presets
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ripe-net-vlan-presets'

const DEFAULT_PRESETS: VlanPreset[] = [
  {
    id: 'preset-office',
    name: 'Office',
    builtIn: false,
    templates: [
      { vlanId: 10, name: 'Management', purpose: 'Network management', hostsNeeded: 10 },
      { vlanId: 20, name: 'Users', purpose: 'End-user workstations', hostsNeeded: 100 },
      { vlanId: 30, name: 'Voice', purpose: 'VoIP phones', hostsNeeded: 50 },
      { vlanId: 40, name: 'Printers', purpose: 'Printers & peripherals', hostsNeeded: 10 },
      { vlanId: 50, name: 'Guest', purpose: 'Guest Wi-Fi', hostsNeeded: 30 },
    ],
  },
  {
    id: 'preset-datacenter',
    name: 'Data Center',
    builtIn: false,
    templates: [
      { vlanId: 10, name: 'Management', purpose: 'Out-of-band management', hostsNeeded: 20 },
      { vlanId: 20, name: 'Servers', purpose: 'Production servers', hostsNeeded: 200 },
      { vlanId: 30, name: 'Storage', purpose: 'SAN / NAS traffic', hostsNeeded: 30 },
      { vlanId: 40, name: 'Backup', purpose: 'Backup network', hostsNeeded: 20 },
      { vlanId: 50, name: 'DMZ', purpose: 'Internet-facing services', hostsNeeded: 20 },
    ],
  },
  {
    id: 'preset-branch',
    name: 'Branch',
    builtIn: false,
    templates: [
      { vlanId: 10, name: 'Management', purpose: 'Network management', hostsNeeded: 5 },
      { vlanId: 20, name: 'Users', purpose: 'End-user devices', hostsNeeded: 30 },
      { vlanId: 30, name: 'Guest', purpose: 'Guest access', hostsNeeded: 10 },
    ],
  },
]

function loadPresets(): VlanPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as VlanPreset[]
  } catch { /* ignore */ }
  // First run: seed with defaults
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PRESETS))
  return [...DEFAULT_PRESETS]
}

function savePresets(presets: VlanPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function getAllPresets(): VlanPreset[] {
  return loadPresets()
}

export function saveCurrentAsPreset(name: string, state: WizardState): VlanPreset {
  const preset: VlanPreset = {
    id: 'preset-' + tempId(),
    name,
    builtIn: false,
    templates: state.vlanTemplates.map(({ vlanId, name: n, purpose, hostsNeeded }) => ({
      vlanId,
      name: n,
      purpose,
      hostsNeeded,
    })),
  }
  const all = loadPresets()
  all.push(preset)
  savePresets(all)
  return preset
}

export function deleteCustomPreset(id: string): void {
  const remaining = loadPresets().filter((p) => p.id !== id)
  savePresets(remaining)
}

// ---------------------------------------------------------------------------
// Sequential Fixed-Size Addressing
// ---------------------------------------------------------------------------

/** Pack subnets sequentially from supernet base, incrementing by block size */
export function buildSequentialFixedPlan(state: WizardState): WizardAddressEntry[] {
  const [ipStr, prefixStr] = state.supernet.split('/')
  const parts = ipStr.split('.').map(Number)
  const baseNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  const superPrefix = parseInt(prefixStr, 10)
  const subPrefix = state.sequentialFixedPrefix
  const blockSize = 1 << (32 - subPrefix)

  // Align base to supernet boundary
  const superMask = (0xffffffff << (32 - superPrefix)) >>> 0
  const alignedBase = (baseNum & superMask) >>> 0

  const plan: WizardAddressEntry[] = []
  let offset = 0

  for (const site of state.sites) {
    const overrides = state.perSiteOverrides[site.tempId] ?? []
    for (let i = 0; i < state.vlanTemplates.length; i++) {
      const tpl = state.vlanTemplates[i]
      const override = overrides[i]
      if (override?.skip) continue

      const subnetNum = (alignedBase + offset) >>> 0
      const subnet = numToIp(subnetNum) + '/' + subPrefix
      plan.push({
        siteTempId: site.tempId,
        vlanTempId: tpl.tempId,
        subnet,
        gateway: computeGateway(subnet),
      })
      offset += blockSize
    }
  }

  return plan
}

/** Validate sequential fixed-size mode. Returns error messages or empty array. */
export function validateSequentialFixed(state: WizardState): string[] {
  const errors: string[] = []
  if (!state.supernet.includes('/')) return ['Invalid supernet']
  const superPrefix = parseInt(state.supernet.split('/')[1], 10)
  const subPrefix = state.sequentialFixedPrefix

  if (subPrefix <= superPrefix) {
    errors.push(`Subnet prefix /${subPrefix} must be larger than supernet /${superPrefix}`)
    return errors
  }

  // Count total non-skipped subnets needed
  let needed = 0
  for (const site of state.sites) {
    const overrides = state.perSiteOverrides[site.tempId] ?? []
    for (let i = 0; i < state.vlanTemplates.length; i++) {
      if (!overrides[i]?.skip) needed++
    }
  }

  const available = 1 << (subPrefix - superPrefix)
  if (needed > available) {
    errors.push(
      `Need ${needed} /${subPrefix} subnets but supernet /${superPrefix} only contains ${available}`,
    )
  }

  return errors
}

// ---------------------------------------------------------------------------
// Site-in-2nd-Octet Addressing
// ---------------------------------------------------------------------------

/**
 * Build site-in-octet address plan.
 * Format: {firstOctet}.{siteIdx+1}.{vlanId}.0/{prefix}
 */
export function buildSiteInOctetPlan(state: WizardState): WizardAddressEntry[] {
  const [ipStr] = state.supernet.split('/')
  const firstOctet = parseInt(ipStr.split('.')[0], 10)
  const subPrefix = state.vlanAlignedPrefix

  const plan: WizardAddressEntry[] = []

  for (let siteIdx = 0; siteIdx < state.sites.length; siteIdx++) {
    const site = state.sites[siteIdx]
    const overrides = state.perSiteOverrides[site.tempId] ?? []
    const siteOctet = siteIdx + 1

    for (let i = 0; i < state.vlanTemplates.length; i++) {
      const tpl = state.vlanTemplates[i]
      const override = overrides[i]
      if (override?.skip) continue

      const effectiveVlanId = getVlanIdForSite(tpl.vlanId, siteIdx, state)
      const subnetNum =
        ((firstOctet << 24) | (siteOctet << 16) | ((effectiveVlanId & 0xff) << 8) | 0) >>> 0
      const subnet = numToIp(subnetNum) + '/' + subPrefix
      plan.push({
        siteTempId: site.tempId,
        vlanTempId: tpl.tempId,
        subnet,
        gateway: computeGateway(subnet),
      })
    }
  }

  return plan
}

/** Validate site-in-octet mode constraints. Returns error messages or empty array. */
export function validateSiteInOctet(state: WizardState): string[] {
  const errors: string[] = []
  if (!state.supernet.includes('/')) return ['Invalid supernet']
  const prefix = parseInt(state.supernet.split('/')[1], 10)

  if (prefix > 8) {
    errors.push('Site-in-octet mode requires a supernet of /8 or larger')
  }

  if (state.sites.length > 254) {
    errors.push(`Maximum 254 sites supported (2nd octet 1–254), but ${state.sites.length} defined`)
  }

  // Check all effective VLAN IDs fit in a single octet (0–255)
  for (let siteIdx = 0; siteIdx < state.sites.length; siteIdx++) {
    for (const tpl of state.vlanTemplates) {
      const vid = getVlanIdForSite(tpl.vlanId, siteIdx, state)
      if (vid > 255 || vid < 0) {
        errors.push(
          `VLAN IDs must be 0–255 for 3rd-octet mapping. VLAN ${tpl.vlanId} at site ${siteIdx + 1} resolves to ${vid}`,
        )
        return errors
      }
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Route Summarization
// ---------------------------------------------------------------------------

function ipToNum(ip: string): number {
  const parts = ip.split('.').map(Number)
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

/** Compute per-site summary routes for the current address plan */
export function computeSiteSummaryRoutes(state: WizardState): SiteSummaryRoute[] {
  const results: SiteSummaryRoute[] = []

  for (const site of state.sites) {
    const siteEntries = state.addressPlan.filter((e) => e.siteTempId === site.tempId)
    if (siteEntries.length === 0) {
      results.push({
        siteTempId: site.tempId,
        summaryRoute: '',
        subnetCount: 0,
        canSummarize: false,
        message: 'No subnets allocated',
      })
      continue
    }

    // Find the range spanning all subnets
    let minAddr = 0xffffffff
    let maxAddr = 0

    for (const entry of siteEntries) {
      const [ip, pStr] = entry.subnet.split('/')
      const netNum = ipToNum(ip)
      const prefix = parseInt(pStr, 10)
      const hostBits = 32 - prefix
      const broadcast = (netNum | ((1 << hostBits) - 1)) >>> 0
      if (netNum < minAddr) minAddr = netNum
      if (broadcast > maxAddr) maxAddr = broadcast
    }

    // Find smallest prefix that covers minAddr..maxAddr
    const range = (maxAddr - minAddr + 1) >>> 0
    let summaryBits = 0
    let test = range
    while (test > 1) {
      test >>>= 1
      summaryBits++
    }
    // Ensure power of 2
    if ((1 << summaryBits) < range) summaryBits++

    const summaryPrefix = 32 - summaryBits
    const summaryMask = summaryPrefix === 0 ? 0 : (0xffffffff << summaryBits) >>> 0
    const summaryNet = (minAddr & summaryMask) >>> 0
    const summaryBroadcast = (summaryNet | ((1 << summaryBits) - 1)) >>> 0

    const summaryRoute = numToIp(summaryNet) + '/' + summaryPrefix

    // Check if summary cleanly covers all subnets (no wasted space outside allocated)
    let allocatedTotal = 0
    for (const entry of siteEntries) {
      const prefix = parseInt(entry.subnet.split('/')[1], 10)
      allocatedTotal += 1 << (32 - prefix)
    }

    const summaryTotal = (summaryBroadcast - summaryNet + 1) >>> 0
    const canSummarize = allocatedTotal === summaryTotal

    results.push({
      siteTempId: site.tempId,
      summaryRoute,
      subnetCount: siteEntries.length,
      canSummarize,
      message: canSummarize
        ? `Clean summary: ${summaryRoute} covers all ${siteEntries.length} subnets`
        : `${summaryRoute} covers all ${siteEntries.length} subnets but includes ${summaryTotal - allocatedTotal} unused addresses`,
    })
  }

  return results
}
