import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'
import { cn, copyToClipboard } from '@/lib/utils'

interface CopyableIPProps {
  ip: string
  className?: string
}

export function CopyableIP({ ip, className }: CopyableIPProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const bare = ip.split('/')[0]
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
        'group inline-flex items-center gap-1.5 font-mono text-sm hover:text-primary transition-colors',
        className,
      )}
      title="Click to copy"
    >
      <span>{ip}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}
