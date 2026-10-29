import { ChevronLeftIcon, ChevronRightIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { platformContent } from '@/data/platform'
import { getCopy } from '@/lib/copy-server'
import { platformHref } from '@/lib/platform-params'

type PlatformPagerProps = {
  base: string
  /** The list's other params, kept on every page link. */
  params: Record<string, string | number | undefined>
  page: number
  pageSize: number
  total: number
}

const EDGE =
  'inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-body text-foreground shadow-input transition-[background-color] hover:bg-muted [&_svg]:size-4'

/** "26–50 of 112" with Previous and Next links, under a console list. */
export default async function PlatformPager({
  base,
  params,
  page,
  pageSize,
  total,
}: PlatformPagerProps) {
  const copy = await getCopy(platformContent)
  // Early returns
  if (total === 0) return null

  // Render logic
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const prev = page > 1 ? platformHref(base, { ...params, page: page - 1 }) : null
  const next = to < total ? platformHref(base, { ...params, page: page + 1 }) : null

  return (
    <div className="flex items-center justify-end gap-3 border-border border-t px-4 py-3">
      <span className="text-caption text-muted-foreground tabular-nums">
        {copy.pager.range(Math.min(from, total), to, total)}
      </span>
      <PagerLink href={prev}>
        <ChevronLeftIcon />
        {copy.pager.previous}
      </PagerLink>
      <PagerLink href={next}>
        {copy.pager.next}
        <ChevronRightIcon />
      </PagerLink>
    </div>
  )
}

function PagerLink({ href, children }: { href: string | null; children: ReactNode }) {
  return href ? (
    <Link href={href} className={EDGE}>
      {children}
    </Link>
  ) : (
    <span className={cn(EDGE, 'pointer-events-none opacity-50')} aria-disabled="true">
      {children}
    </span>
  )
}
