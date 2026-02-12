import type {
  WizardState,
  WizardTunnelEntry,
  WizardAddressEntry,
  VLSMResult,
  VLSMAllocation,
} from './wizard.types'

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
