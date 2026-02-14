import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { projectsApi, sitesApi, vlansApi, subnetsApi, tunnelsApi } from '@/api/endpoints'
import type { WizardState } from '@/lib/wizard.types'
import { getVlanIdForSite } from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onBack: () => void
}

type CreationPhase =
  | 'idle'
  | 'project'
  | 'sites'
  | 'vlans'
  | 'subnets'
  | 'tunnels'
  | 'done'
  | 'error'

interface CreationProgress {
  phase: CreationPhase
  current: number
  total: number
  error?: string
}

export function WizardStepReview({ state, onBack }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<CreationProgress>({
    phase: 'idle',
    current: 0,
    total: 0,
  })

  const getSiteName = (tempId: string) =>
    state.sites.find((s) => s.tempId === tempId)?.name ?? tempId

  const getVlanInfo = (vlanTempId: string, siteTempId: string) => {
    if (state.vlanMode === 'manual') {
      return state.perSiteVlans[siteTempId]?.find((v) => v.tempId === vlanTempId)
    }
    return state.vlanTemplates.find((t) => t.tempId === vlanTempId)
  }

  const newSites = state.sites.filter((s) => !s.realId)
  const newAddressEntries = state.addressPlan.filter((e) => !e.realSubnetId)

  const totalEntities =
    (state.projectMode === 'new' ? 1 : 0) +
    newSites.length +
    newAddressEntries.length * 2 + // VLANs + subnets
    state.tunnelPlan.length

  const createAll = async () => {
    try {
      // 1. Project
      let projectId = state.projectId!
      if (state.projectMode === 'new') {
        setProgress({ phase: 'project', current: 0, total: 1 })
        const res = await projectsApi.create({
          name: state.projectName,
          description: state.projectDescription,
          supernet: state.supernet,
        })
        projectId = res.data.id
      }

      // 2. Sites — skip existing ones (realId set)
      const siteIdMap = new Map<string, number>()
      for (const site of state.sites) {
        if (site.realId) siteIdMap.set(site.tempId, site.realId)
      }
      setProgress({ phase: 'sites', current: 0, total: newSites.length })
      for (let i = 0; i < newSites.length; i++) {
        const site = newSites[i]
        const res = await sitesApi.create(projectId, {
          name: site.name,
          address: site.address,
          supernet: state.siteSupernetsEnabled && site.supernet?.trim() ? site.supernet.trim() : null,
          latitude: site.latitude,
          longitude: site.longitude,
          wan_addresses: site.wanAddresses.filter((w) => w.ip_address.trim()),
        })
        siteIdMap.set(site.tempId, res.data.id)
        setProgress({ phase: 'sites', current: i + 1, total: newSites.length })
      }

      // 2b. Update existing sites with WAN addresses if changed
      const existingSites = state.sites.filter((s) => s.realId)
      for (const site of existingSites) {
        const wanFiltered = site.wanAddresses.filter((w) => w.ip_address.trim())
        if (wanFiltered.length > 0) {
          await sitesApi.update(projectId, site.realId!, {
            wan_addresses: wanFiltered,
          })
        }
      }

      // 3. VLANs — skip existing ones (realVlanId set), create new
      const vlanIdMap = new Map<string, number>() // key: "siteTempId:vlanTempId"
      // Pre-populate map with existing VLANs
      for (const entry of state.addressPlan) {
        if (entry.realVlanId) {
          vlanIdMap.set(`${entry.siteTempId}:${entry.vlanTempId}`, entry.realVlanId)
        }
      }
      setProgress({ phase: 'vlans', current: 0, total: newAddressEntries.length })
      for (let i = 0; i < newAddressEntries.length; i++) {
        const entry = newAddressEntries[i]
        // Skip if we already have a real VLAN ID for this combination
        const mapKey = `${entry.siteTempId}:${entry.vlanTempId}`
        if (vlanIdMap.has(mapKey)) {
          setProgress({ phase: 'vlans', current: i + 1, total: newAddressEntries.length })
          continue
        }

        const realSiteId = siteIdMap.get(entry.siteTempId)!
        const siteIdx = state.sites.findIndex((s) => s.tempId === entry.siteTempId)

        let effectiveVlanId: number
        let effectiveName: string
        let effectivePurpose: string

        if (state.vlanMode === 'manual') {
          const mv = state.perSiteVlans[entry.siteTempId]?.find((v) => v.tempId === entry.vlanTempId)
          effectiveVlanId = mv?.vlanId ?? 0
          effectiveName = mv?.name ?? ''
          effectivePurpose = mv?.purpose ?? ''
        } else {
          const tpl = state.vlanTemplates.find((t) => t.tempId === entry.vlanTempId)!
          const tplIdx = state.vlanTemplates.findIndex((t) => t.tempId === entry.vlanTempId)
          const override = state.perSiteOverrides[entry.siteTempId]?.[tplIdx]
          effectiveVlanId = getVlanIdForSite(tpl.vlanId, siteIdx, state)
          effectiveName = override?.name || tpl.name
          effectivePurpose = tpl.purpose
        }

        const res = await vlansApi.create({
          site: realSiteId,
          vlan_id: effectiveVlanId,
          name: effectiveName,
          purpose: effectivePurpose,
        })
        vlanIdMap.set(mapKey, res.data.id)
        setProgress({ phase: 'vlans', current: i + 1, total: newAddressEntries.length })
      }

      // 4. Subnets — skip existing ones (realSubnetId set)
      setProgress({ phase: 'subnets', current: 0, total: newAddressEntries.length })
      for (let i = 0; i < newAddressEntries.length; i++) {
        const entry = newAddressEntries[i]
        const realVlanId = vlanIdMap.get(`${entry.siteTempId}:${entry.vlanTempId}`)!
        await subnetsApi.create({
          vlan: realVlanId,
          network: entry.subnet,
          gateway: entry.gateway,
        })
        setProgress({ phase: 'subnets', current: i + 1, total: newAddressEntries.length })
      }

      // 5. Tunnels
      if (state.tunnelPlan.length > 0) {
        setProgress({ phase: 'tunnels', current: 0, total: state.tunnelPlan.length })
        for (let i = 0; i < state.tunnelPlan.length; i++) {
          const t = state.tunnelPlan[i]
          await tunnelsApi.create({
            project: projectId,
            name: t.name,
            tunnel_type: state.tunnelType,
            tunnel_subnet: t.tunnelSubnet,
            site_a: siteIdMap.get(t.siteATempId),
            site_b: siteIdMap.get(t.siteBTempId),
            ip_a: t.ipA,
            ip_b: t.ipB,
          })
          setProgress({ phase: 'tunnels', current: i + 1, total: state.tunnelPlan.length })
        }
      }

      setProgress({ phase: 'done', current: totalEntities, total: totalEntities })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Network design created successfully!')
      setTimeout(() => navigate(`/projects/${projectId}`), 800)
    } catch (err: unknown) {
      let msg = 'Creation failed'
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response: { data: unknown; status: number } }).response
        const data = resp?.data
        if (data && typeof data === 'object' && 'detail' in data) {
          msg = String((data as { detail: string }).detail)
        } else if (data) {
          msg = `${resp.status}: ${JSON.stringify(data).slice(0, 300)}`
        }
      } else if (err instanceof Error) {
        msg = err.message
      }
      setProgress((p) => ({ ...p, phase: 'error', error: msg }))
      toast.error(msg)
    }
  }

  const isCreating = progress.phase !== 'idle' && progress.phase !== 'done' && progress.phase !== 'error'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Review & Create</h2>
        <p className="text-sm text-muted-foreground">
          Review your network design{totalEntities > 0 ? ` before creating ${totalEntities} new entit${totalEntities === 1 ? 'y' : 'ies'}` : ''}.
          {state.addressPlan.length > newAddressEntries.length && (
            <> {state.addressPlan.length - newAddressEntries.length} existing entit{state.addressPlan.length - newAddressEntries.length === 1 ? 'y' : 'ies'} will be preserved.</>
          )}
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {/* Project */}
        <div className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Project
          </h3>
          <p className="font-medium">
            {state.projectMode === 'new' ? state.projectName : `Existing project #${state.projectId}`}
          </p>
          <p className="text-sm text-muted-foreground font-mono">{state.supernet}</p>
        </div>

        {/* Sites */}
        <div className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Sites ({state.sites.length}{newSites.length < state.sites.length ? `, ${newSites.length} new` : ''})
          </h3>
          <div className="flex flex-wrap gap-2">
            {state.sites.map((s) => {
              const hasOverride = state.siteSupernetsEnabled && s.supernet?.trim()
              return (
                <span
                  key={s.tempId}
                  className="rounded-md bg-muted px-2 py-1 text-sm"
                >
                  {s.name}
                  {s.realId && (
                    <span className="ml-1 text-xs text-muted-foreground">(existing)</span>
                  )}
                  {hasOverride && (
                    <span className="ml-1 font-mono text-xs text-blue-500">
                      ({s.supernet.trim()})
                    </span>
                  )}
                  {s.wanAddresses.filter((w) => w.ip_address.trim()).length > 0 && (
                    <span className="ml-1 font-mono text-xs text-muted-foreground">
                      {s.wanAddresses.filter((w) => w.ip_address.trim()).map((w) => w.ip_address).join(', ')}
                    </span>
                  )}
                  {s.latitude != null && s.longitude != null && (
                    <span className="ml-1 font-mono text-xs text-muted-foreground">
                      ({s.latitude}, {s.longitude})
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </div>

        {/* Address Plan */}
        <div className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            VLANs & Subnets ({state.addressPlan.length}{newAddressEntries.length < state.addressPlan.length ? `, ${newAddressEntries.length} new` : ''})
          </h3>
          <div className="space-y-1 text-sm">
            {state.sites.map((site, siteIdx) => {
              const siteEntries = state.addressPlan.filter((e) => e.siteTempId === site.tempId)
              if (siteEntries.length === 0) return null
              return (
                <div key={site.tempId}>
                  <span className="font-medium">{site.name}:</span>{' '}
                  {siteEntries.map((e, i) => {
                    const vlan = getVlanInfo(e.vlanTempId, site.tempId)
                    let vid: number | string = '?'
                    let displayName = ''
                    if (state.vlanMode === 'manual' && vlan) {
                      vid = vlan.vlanId
                      displayName = vlan.name
                    } else if (vlan) {
                      vid = getVlanIdForSite(vlan.vlanId, siteIdx, state)
                      const tplIdx = state.vlanTemplates.findIndex((t) => t.tempId === e.vlanTempId)
                      const overrideName = state.perSiteOverrides[site.tempId]?.[tplIdx]?.name
                      displayName = overrideName || vlan.name
                    }
                    return (
                      <span key={i} className="text-muted-foreground">
                        {i > 0 && ', '}
                        VLAN {vid} {displayName} <span className="font-mono text-xs">{e.subnet}</span>
                        {e.realSubnetId && <span className="text-xs ml-1">(existing)</span>}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* Tunnels */}
        {state.tunnelPlan.length > 0 && (
          <div className="p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Tunnels ({state.tunnelPlan.length}) — {state.tunnelMode}, {state.tunnelType}
            </h3>
            <div className="space-y-1 text-sm">
              {state.tunnelPlan.map((t, i) => (
                <div key={i} className="text-muted-foreground">
                  {getSiteName(t.siteATempId)} ({t.ipA}) ↔ {getSiteName(t.siteBTempId)} ({t.ipB}){' '}
                  <span className="font-mono text-xs">{t.tunnelSubnet}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      {progress.phase !== 'idle' && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {progress.phase === 'done' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : progress.phase === 'error' ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            <span className="font-medium">
              {progress.phase === 'done'
                ? (totalEntities > 0 ? 'All entities created!' : 'Done — nothing new to create.')
                : progress.phase === 'error'
                  ? `Error: ${progress.error}`
                  : `Creating ${progress.phase}... ${progress.current}/${progress.total}`}
            </span>
          </div>
          {isCreating && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(5, (progress.current / Math.max(progress.total, 1)) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isCreating}
          className="rounded-md border border-border px-6 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={createAll}
          disabled={isCreating || progress.phase === 'done'}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : progress.phase === 'error' ? 'Retry' : 'Create All'}
        </button>
      </div>
    </div>
  )
}
