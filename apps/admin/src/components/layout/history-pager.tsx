'use client'

import { Button } from '@commerce/ui/shadcn/button'

type HistoryPagerProps = {
  /** The server has lines past the ones shown. */
  hasMore: boolean
  /** More than the first page is open: offer to fold it back. */
  expanded: boolean
  /** The next lines are on their way. */
  loading: boolean
  moreLabel: string
  lessLabel: string
  onMore: () => void
  onLess: () => void
}

/**
 * "Show older" / "Show fewer" under an in-card history (the customer page's Store credit and
 * Loyalty points cards), as the Timeline card's own button: a card shows its newest lines and
 * asks the server for more only when staff want them. Nothing when there is one page.
 */
export default function HistoryPager({
  hasMore,
  expanded,
  loading,
  moreLabel,
  lessLabel,
  onMore,
  onLess,
}: HistoryPagerProps) {
  // Early returns
  if (!hasMore && !expanded) return null

  return (
    <div className="-ml-2 flex items-center gap-1">
      {hasMore ? (
        <Button variant="ghost" size="sm" onClick={onMore} loading={loading}>
          {moreLabel}
        </Button>
      ) : null}
      {expanded ? (
        <Button variant="ghost" size="sm" onClick={onLess} disabled={loading}>
          {lessLabel}
        </Button>
      ) : null}
    </div>
  )
}
