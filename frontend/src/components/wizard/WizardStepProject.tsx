import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { projectsApi } from '@/api/endpoints'
import type { WizardState, WizardSite, WizardManualVlan, WizardAddressEntry } from '@/lib/wizard.types'
import type { ProjectTopology } from '@/types'
import { tempId as genTempId, ipToNum, numToIp } from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
}

/** Compute a covering CIDR from a set of network ranges */
function coveringCidr(ranges: { net: number; broadcast: number }[]): string {
  let minAddr = ranges[0].net
  let maxAddr = ranges[0].broadcast
  for (const r of ranges) {
    if (r.net < minAddr) minAddr = r.net
    if (r.broadcast > maxAddr) maxAddr = r.broadcast
  }
  const xor = (minAddr ^ maxAddr) >>> 0
  let prefix = 0
  for (let bit = 31; bit >= 0; bit--) {
    if ((xor >>> bit) & 1) break
    prefix++
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const netAddr = (minAddr & mask) >>> 0
  return numToIp(netAddr) + '/' + prefix
}

/** Infer a covering supernet CIDR from a list of subnet CIDRs */
function inferSupernet(cidrs: string[]): string {
  if (cidrs.length === 0) return ''
  const ranges = cidrs.map((c) => {
    const [ip, pStr] = c.split('/')
    const net = ipToNum(ip)
    const prefix = parseInt(pStr, 10)
    const broadcast = (net | ((1 << (32 - prefix)) - 1)) >>> 0
    return { net, broadcast }
  })
  // Try covering all subnets
  const result = coveringCidr(ranges)
  const resultPrefix = parseInt(result.split('/')[1], 10)
  if (resultPrefix >= 8) return result

  // Too broad — group by /16 and pick the largest group
  const groups = new Map<number, { net: number; broadcast: number }[]>()
  for (const r of ranges) {
    const key = (r.net >>> 16) & 0xffff
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }
  let best: { net: number; broadcast: number }[] | null = null
  for (const g of groups.values()) {
    if (!best || g.length > best.length) best = g
  }
  return coveringCidr(best ?? ranges)
}

/** Convert a topology response into wizard state fields */
function topologyToWizardState(
  topo: ProjectTopology,
  supernet: string,
): Partial<WizardState> {
  const sites: WizardSite[] = []
  const perSiteVlans: Record<string, WizardManualVlan[]> = {}
  const addressPlan: WizardAddressEntry[] = []

  // Maps: real DB id → generated tempId
  const siteIdToTempId = new Map<number, string>()
  const vlanIdToTempId = new Map<number, string>()

  for (const st of topo.sites) {
    const siteTempId = genTempId()
    siteIdToTempId.set(st.id, siteTempId)

    sites.push({
      tempId: siteTempId,
      name: st.name,
      address: st.address ?? '',
      supernet: '',
      latitude: st.latitude,
      longitude: st.longitude,
      wanAddresses: (st.wan_addresses ?? []).map((w) => ({ ip_address: w.ip_address, label: w.label })),
      realId: st.id,
    })

    const siteVlans: WizardManualVlan[] = []
    for (const vt of st.vlans) {
      const vlanTempId = genTempId()
      vlanIdToTempId.set(vt.id, vlanTempId)

      // hostsNeeded: derive from first subnet prefix, or default to 10
      let hostsNeeded = 10
      if (vt.subnets.length > 0) {
        const prefix = parseInt(vt.subnets[0].network.split('/')[1], 10)
        if (!isNaN(prefix) && prefix < 32) {
          hostsNeeded = Math.max(1, (1 << (32 - prefix)) - 2)
        }
      }

      siteVlans.push({
        tempId: vlanTempId,
        vlanId: vt.vlan_id,
        name: vt.name,
        purpose: vt.purpose,
        hostsNeeded,
        realId: vt.id,
      })

      // Each subnet → address entry
      for (const sn of vt.subnets) {
        addressPlan.push({
          siteTempId,
          vlanTempId,
          subnet: sn.network,
          gateway: sn.gateway ?? '',
          realSubnetId: sn.id,
          realVlanId: vt.id,
        })
      }
    }

    perSiteVlans[siteTempId] = siteVlans
  }

  // Infer supernet from loaded subnets if project doesn't have one
  let effectiveSupernet = supernet
  if (!effectiveSupernet) {
    const allCidrs = addressPlan.map((e) => e.subnet).filter(Boolean)
    effectiveSupernet = inferSupernet(allCidrs)
  }

  return {
    sites,
    vlanMode: 'manual',
    perSiteVlans,
    addressPlan,
    addressingMode: 'manual',
    supernet: effectiveSupernet,
  }
}

export function WizardStepProject({ state, onChange, onNext }: Props) {
  const [loadingTopo, setLoadingTopo] = useState(false)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    select: (res) => res.data.results,
  })

  const valid =
    state.projectMode === 'new'
      ? state.projectName.trim() !== ''
      : state.projectId !== undefined

  const handleProjectSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value, 10)
    if (isNaN(id)) return
    const proj = projects?.find((p) => p.id === id)
    const supernet = proj?.supernet ?? state.supernet

    // Set basic fields immediately
    onChange({ projectId: id, supernet })

    // Fetch topology and populate wizard state
    setLoadingTopo(true)
    try {
      const res = await projectsApi.topology(id)
      const topo = res.data
      if (topo.sites.length > 0) {
        const patch = topologyToWizardState(topo, supernet)
        onChange({ projectId: id, ...patch })
      }
    } catch {
      // Topology fetch failed — keep basic fields, user starts fresh
    } finally {
      setLoadingTopo(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Project Setup</h2>
        <p className="text-sm text-muted-foreground">
          Choose an existing project or create a new one.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange({ projectMode: 'new', projectId: undefined })}
          className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
            state.projectMode === 'new'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          }`}
        >
          New Project
        </button>
        <button
          type="button"
          onClick={() => onChange({ projectMode: 'existing' })}
          className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
            state.projectMode === 'existing'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          }`}
        >
          Existing Project
        </button>
      </div>

      {state.projectMode === 'new' ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Project Name <span className="text-red-500">*</span></label>
            <input
              value={state.projectName}
              onChange={(e) => onChange({ projectName: e.target.value })}
              placeholder="e.g. Corporate WAN"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Description</label>
            <input
              value={state.projectDescription}
              onChange={(e) => onChange({ projectDescription: e.target.value })}
              placeholder="Optional description"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Select Project <span className="text-red-500">*</span></label>
            <select
              value={state.projectId ?? ''}
              onChange={handleProjectSelect}
              disabled={loadingTopo}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">Choose a project...</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.supernet ? `(${p.supernet})` : ''}
                </option>
              ))}
            </select>
          </div>
          {loadingTopo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading project data...
            </div>
          )}
          {!loadingTopo && state.projectId && state.sites.length > 0 && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-1">
                Loaded {state.sites.length} site{state.sites.length !== 1 ? 's' : ''},{' '}
                {state.addressPlan.length} subnet{state.addressPlan.length !== 1 ? 's' : ''}
              </p>
              <p className="text-muted-foreground text-xs">
                Existing entities will be preserved. You can add new sites, VLANs, and tunnels.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!valid || loadingTopo}
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
