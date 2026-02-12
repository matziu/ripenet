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
  const getVlanTemplate = (tempId: string) =>
    state.vlanTemplates.find((t) => t.tempId === tempId)

  const totalEntities =
    (state.projectMode === 'new' ? 1 : 0) +
    state.sites.length +
    state.addressPlan.length * 2 + // VLANs + subnets
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

      // 2. Sites
      const siteIdMap = new Map<string, number>()
      setProgress({ phase: 'sites', current: 0, total: state.sites.length })
      for (let i = 0; i < state.sites.length; i++) {
        const site = state.sites[i]
        const res = await sitesApi.create(projectId, {
          name: site.name,
          address: site.address,
        })
        siteIdMap.set(site.tempId, res.data.id)
        setProgress({ phase: 'sites', current: i + 1, total: state.sites.length })
      }

      // 3. VLANs — use per-site VLAN IDs + name overrides
      const vlanIdMap = new Map<string, number>() // key: "siteTempId:vlanTempId"
      const vlanEntries = state.addressPlan
      setProgress({ phase: 'vlans', current: 0, total: vlanEntries.length })
      for (let i = 0; i < vlanEntries.length; i++) {
        const entry = vlanEntries[i]
        const realSiteId = siteIdMap.get(entry.siteTempId)!
        const tpl = getVlanTemplate(entry.vlanTempId)!
        const siteIdx = state.sites.findIndex((s) => s.tempId === entry.siteTempId)
        const tplIdx = state.vlanTemplates.findIndex((t) => t.tempId === entry.vlanTempId)
        const override = state.perSiteOverrides[entry.siteTempId]?.[tplIdx]
        const effectiveVlanId = getVlanIdForSite(tpl.vlanId, siteIdx, state)
        const res = await vlansApi.create({
          site: realSiteId,
          vlan_id: effectiveVlanId,
          name: override?.name || tpl.name,
          purpose: tpl.purpose,
        })
        vlanIdMap.set(`${entry.siteTempId}:${entry.vlanTempId}`, res.data.id)
        setProgress({ phase: 'vlans', current: i + 1, total: vlanEntries.length })
      }

      // 4. Subnets
      setProgress({ phase: 'subnets', current: 0, total: vlanEntries.length })
      for (let i = 0; i < vlanEntries.length; i++) {
        const entry = vlanEntries[i]
        const realVlanId = vlanIdMap.get(`${entry.siteTempId}:${entry.vlanTempId}`)!
        await subnetsApi.create({
          vlan: realVlanId,
          network: entry.subnet,
          gateway: entry.gateway,
        })
        setProgress({ phase: 'subnets', current: i + 1, total: vlanEntries.length })
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
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response: { data: { detail?: string } } }).response?.data?.detail ?? 'Creation failed')
          : 'Creation failed'
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
          Review your network design before creating {totalEntities} entities.
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
            Sites ({state.sites.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {state.sites.map((s) => (
              <span
                key={s.tempId}
                className="rounded-md bg-muted px-2 py-1 text-sm"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>

        {/* Address Plan */}
        <div className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            VLANs & Subnets ({state.addressPlan.length})
          </h3>
          <div className="space-y-1 text-sm">
            {state.sites.map((site) => {
              const siteIdx = state.sites.indexOf(site)
              const siteEntries = state.addressPlan.filter((e) => e.siteTempId === site.tempId)
              if (siteEntries.length === 0) return null
              return (
                <div key={site.tempId}>
                  <span className="font-medium">{site.name}:</span>{' '}
                  {siteEntries.map((e, i) => {
                    const tpl = getVlanTemplate(e.vlanTempId)
                    const vid = tpl ? getVlanIdForSite(tpl.vlanId, siteIdx, state) : '?'
                    const tplIdx = state.vlanTemplates.findIndex((t) => t.tempId === e.vlanTempId)
                    const overrideName = state.perSiteOverrides[site.tempId]?.[tplIdx]?.name
                    const displayName = overrideName || tpl?.name
                    return (
                      <span key={i} className="text-muted-foreground">
                        {i > 0 && ', '}
                        VLAN {vid} {displayName} <span className="font-mono text-xs">{e.subnet}</span>
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
                ? 'All entities created!'
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
