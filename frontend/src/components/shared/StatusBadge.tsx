import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  planned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  reserved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  dhcp: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  decommissioned: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  down: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  planning: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
        statusColors[status] ?? 'bg-gray-100 text-gray-800',
        className,
      )}
    >
      {status}
    </span>
  )
}
