import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    comply: 'Comply',
    not_comply: 'Not Comply',
    noted: 'Noted',
    not_part_of_proposal: 'Not Part of Proposal',
    header: 'Header',
  }
  return map[status] ?? status
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    comply: 'var(--status-comply)',
    not_comply: 'var(--status-not-comply)',
    noted: 'var(--status-noted)',
    not_part_of_proposal: 'var(--status-not-part)',
    header: 'var(--brand-primary)',
  }
  return map[status] ?? 'var(--text-muted)'
}

export function getStatusBgClass(status: string): string {
  const map: Record<string, string> = {
    comply: 'bg-status-comply',
    not_comply: 'bg-status-not-comply',
    noted: 'bg-status-noted',
    not_part_of_proposal: 'bg-status-not-part',
    header: 'bg-status-header',
  }
  return map[status] ?? ''
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-AE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDate(date)
}

export function computeTextHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}
