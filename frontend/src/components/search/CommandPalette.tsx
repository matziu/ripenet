import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchApi } from '@/api/endpoints'
import { useUIStore } from '@/stores/ui.store'
import { useTopologyStore } from '@/stores/topology.store'
import { CopyableIP } from '@/components/shared/CopyableIP'
import {
  Search, Server, Network, MapPin, FolderOpen, Globe,
} from 'lucide-react'
import type { SearchResult } from '@/types'

const typeIcons: Record<string, typeof Server> = {
  host: Server,
  subnet: Network,
  vlan: Globe,
  site: MapPin,
  project: FolderOpen,
}

export function CommandPalette() {
  const [query, setQuery] = useState('')
  const open = useUIStore((s) => s.commandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const navigate = useNavigate()
  const setHighlightedNode = useTopologyStore((s) => s.setHighlightedNode)

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, setOpen])

  const { data: results } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchApi.search(query),
    select: (res) => res.data.results,
    enabled: query.length >= 2,
  })

  const grouped = (results ?? []).reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r)
    return acc
  }, {})

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    navigate(`/projects/${result.project_id}`)

    // Highlight node on topology
    if (result.type === 'host' && result.subnet_id) {
      setHighlightedNode(`host-${result.id}`)
    } else if (result.type === 'site') {
      setHighlightedNode(`site-${result.id}`)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <Command
        className="relative w-full max-w-lg rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        shouldFilter={false}
      >
        <div className="flex items-center border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search IP, hostname, subnet, VLAN..."
            className="flex-1 bg-transparent py-3 px-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-80 overflow-y-auto p-2">
          {query.length < 2 && (
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search...
            </Command.Empty>
          )}

          {query.length >= 2 && (!results || results.length === 0) && (
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
          )}

          {Object.entries(grouped).map(([type, items]) => {
            const Icon = typeIcons[type] ?? Server
            return (
              <Command.Group
                key={type}
                heading={type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5"
              >
                {items.map((item) => (
                  <Command.Item
                    key={`${type}-${item.id}`}
                    value={`${item.label} ${item.secondary}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent aria-selected:bg-accent"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {type === 'host' ? (
                          <CopyableIP ip={item.label} />
                        ) : (
                          <span className="font-medium">{item.label}</span>
                        )}
                        {item.secondary && (
                          <span className="text-muted-foreground truncate">{item.secondary}</span>
                        )}
                      </div>
                      {item.breadcrumb && (
                        <p className="text-[11px] text-muted-foreground truncate">{item.breadcrumb}</p>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )
          })}
        </Command.List>
      </Command>
    </div>
  )
}
