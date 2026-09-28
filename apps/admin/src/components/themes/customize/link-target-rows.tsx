'use client'

import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { customizeContent } from '@/data/customize'
import { LINK_KIND_ICONS } from '@/lib/customize-link-icons'
import type { LinkKind, LinkTarget, RecentLink } from '@/lib/customize-links'

type Row =
  | { type: 'target'; target: LinkTarget }
  | { type: 'recent'; recent: RecentLink }
  | { type: 'kind'; kind: LinkKind }
  | { type: 'home' }

type LinkTargetRowsProps = {
  heading?: string | undefined
  rows: Row[]
  /** The href currently stored, to mark the matching row. */
  value: string
  onPick: (href: string, title: string, kind: RecentLink['kind']) => void
  onOpenKind: (kind: LinkKind) => void
}

export type { Row as LinkRow }

const copy = customizeContent.link

const ROW =
  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[0.8125rem] outline-none transition-colors duration-150 hover:bg-muted focus-visible:bg-muted motion-reduce:transition-none'

/**
 * One titled list in the link picker: recent picks, the kinds to browse
 * into, or search results. Rows carry `data-link-row` so the panel's arrow
 * keys can move between them.
 */
export default function LinkTargetRows({
  heading,
  rows,
  value,
  onPick,
  onOpenKind,
}: LinkTargetRowsProps) {
  // Early returns
  if (rows.length === 0) return null

  // Render logic
  return (
    <div className="flex flex-col gap-0.5">
      {heading ? (
        <p className="px-2 pt-2 pb-1 text-[0.6875rem] leading-4 font-medium text-muted-foreground">
          {heading}
        </p>
      ) : null}
      {rows.map((row) => {
        if (row.type === 'kind') {
          const Icon = LINK_KIND_ICONS[row.kind]
          return (
            <button
              key={`kind-${row.kind}`}
              type="button"
              data-link-row
              onClick={() => onOpenKind(row.kind)}
              className={ROW}
            >
              <Glyph>
                <Icon aria-hidden weight="regular" className="size-3.5" />
              </Glyph>
              <span className="min-w-0 flex-1 truncate">{copy.tabs[row.kind]}</span>
              <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />
            </button>
          )
        }
        const pick =
          row.type === 'home'
            ? { href: '/', title: copy.home, kind: 'home' as const, imageUrl: null }
            : row.type === 'recent'
              ? { ...row.recent, imageUrl: null }
              : { ...row.target, imageUrl: row.target.imageUrl ?? null }
        const Icon = LINK_KIND_ICONS[pick.kind]
        const current = pick.href === value
        return (
          <button
            key={`${row.type}-${pick.href}`}
            type="button"
            data-link-row
            onClick={() => onPick(pick.href, pick.title, pick.kind)}
            aria-current={current ? 'true' : undefined}
            className={cn(ROW, current && 'bg-primary-soft hover:bg-primary-soft')}
          >
            <Glyph>
              {pick.imageUrl ? (
                <Image src={pick.imageUrl} alt="" fill sizes="1.5rem" className="object-cover" />
              ) : (
                <Icon aria-hidden weight="regular" className="size-3.5" />
              )}
            </Glyph>
            <span className="min-w-0 flex-1 truncate">{pick.title}</span>
            {row.type === 'recent' || row.type === 'home' ? (
              <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                {copy.kinds[pick.kind]}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** The square glyph (or thumbnail) at the start of a row. */
function Glyph({ children }: { children: ReactNode }) {
  // Render logic
  return (
    <span className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
      {children}
    </span>
  )
}
