import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import CopyButton from '@/components/fields/copy-button'

export type KeyValueRow = {
  label: string
  /** An empty value (null, undefined, '') shows a muted dash and has nothing to copy. */
  value: ReactNode
  /** Makes the value a link. */
  href?: string
  /** Adds a copy button; the value must be a string. The label names it in the toast. */
  copy?: boolean
  tone?: 'default' | 'muted' | 'danger' | 'success'
  /** Medium weight value. */
  strong?: boolean
  /** Drops the row, so callers can list optional rows inline. */
  hidden?: boolean
}

type KeyValueListProps = {
  rows: readonly KeyValueRow[]
  /** `stack`: the label over its value, one field per block. `grid`: label left, value right. */
  variant?: 'stack' | 'grid'
  className?: string
}

const TONES = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  danger: 'text-danger',
  success: 'text-success',
} as const

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === ''
}

/** A label/value list: every card that shows facts about a record uses this one. */
export default function KeyValueList({ rows, variant = 'stack', className }: KeyValueListProps) {
  // Render logic
  const shown = rows.filter((r) => !r.hidden)

  return (
    <dl
      className={cn(
        variant === 'stack'
          ? '-mx-2 flex flex-col'
          : 'grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2',
        className,
      )}
    >
      {shown.map((r) => {
        const empty = isEmpty(r.value)
        const copyValue = r.copy && !empty && typeof r.value === 'string' ? r.value : null
        const content = empty ? (
          <span className="text-muted-foreground">-</span>
        ) : r.href ? (
          <a href={r.href} className="underline-offset-4 hover:underline">
            {r.value}
          </a>
        ) : (
          r.value
        )
        const valueClass = cn(
          'min-w-0 text-body break-words',
          TONES[r.tone ?? 'default'],
          r.strong && 'font-medium',
        )

        if (variant === 'grid') {
          return (
            <div key={r.label} className="contents">
              <dt className="text-body text-muted-foreground">{r.label}</dt>
              <dd className={cn(valueClass, 'flex items-center justify-end gap-1 text-right')}>
                <span className="min-w-0">{content}</span>
                {copyValue ? <CopyButton value={copyValue} what={r.label} visible /> : null}
              </dd>
            </div>
          )
        }
        return (
          <div
            key={r.label}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
              r.copy && 'hover:bg-row-hover',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <dt className="text-caption text-muted-foreground">{r.label}</dt>
              <dd className={valueClass}>{content}</dd>
            </div>
            {copyValue ? <CopyButton value={copyValue} what={r.label} visible /> : null}
          </div>
        )
      })}
    </dl>
  )
}
