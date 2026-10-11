import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { statusLabels, type ContentStatus } from '@/lib/content/types'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="mb-6 space-y-2">
      {backHref ? (
        <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          ← {backLabel ?? 'Back'}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

const statusTones: Record<ContentStatus, BadgeTone> = {
  draft: 'neutral',
  in_review: 'warning',
  published: 'success',
}

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>
}

export function Panel({
  title,
  children,
  className,
  description,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-card p-4 md:p-5', className)}>
      {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className={title || description ? 'mt-4' : undefined}>{children}</div>
    </section>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        'mb-6 rounded-md border px-4 py-3 text-sm',
        tone === 'warning' && 'border-warning/30 bg-warning/10 text-foreground',
        tone === 'success' && 'border-success/30 bg-success/10 text-foreground',
        tone === 'info' && 'border-border bg-muted/50 text-foreground',
      )}
    >
      {children}
    </div>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  )
}

export const tableClass = 'w-full text-left text-sm'
export const thClass = 'border-b border-border px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap'
export const tdClass = 'border-b border-border px-4 py-3 align-top'
