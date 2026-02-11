import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

interface DropdownMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface DropdownMenuProps {
  items: DropdownMenuItem[]
}

export function DropdownMenu({ items }: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          className="z-50 min-w-[120px] rounded-md border border-border bg-card p-1 shadow-md"
          align="end"
          sideOffset={4}
        >
          {items.map((item) => (
            <DropdownMenuPrimitive.Item
              key={item.label}
              onClick={(e) => {
                e.stopPropagation()
                item.onClick()
              }}
              className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer outline-none transition-colors
                ${item.variant === 'destructive'
                  ? 'text-red-500 hover:bg-red-500/10 focus:bg-red-500/10'
                  : 'hover:bg-accent focus:bg-accent'
                }`}
            >
              {item.icon}
              {item.label}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}
