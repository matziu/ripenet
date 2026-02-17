import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Extract a human-readable error message from an Axios/DRF error response. */
export function extractApiError(err: unknown, fallback = 'Operation failed'): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.detail && typeof data.detail === 'string') return data.detail
  if (data.non_field_errors && Array.isArray(data.non_field_errors))
    return data.non_field_errors.join('. ')
  const messages: string[] = []
  for (const [, value] of Object.entries(data)) {
    if (Array.isArray(value)) messages.push(value.join(', '))
    else if (typeof value === 'string') messages.push(value)
  }
  return messages.length > 0 ? messages.join('. ') : fallback
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}
