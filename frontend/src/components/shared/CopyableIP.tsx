import { useState } from 'react'
import { toast } from 'sonner'
import { cn, copyToClipboard } from '@/lib/utils'

interface CopyableIPProps {
  ip: string
  className?: string
}

export function CopyableIP({ ip, className }: CopyableIPProps) {
  const [copied, setCopied] = useState(false)
  const bare = ip.split('/')[0]

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await copyToClipboard(bare)
      setCopied(true)
      toast.success(`Copied: ${bare}`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'font-mono text-sm cursor-pointer transition-colors',
        copied ? 'text-green-500' : 'hover:text-primary',
        className,
      )}
      title="Click to copy"
    >
      {bare}
    </button>
  )
}
