'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'

type LinkCheckBannerProps = {
  /** How many items in the menu have a broken or hidden link. */
  count: number
}

/** Above the menu items: how many links need attention. The rows carry the detail. */
export default function LinkCheckBanner({ count }: LinkCheckBannerProps) {
  // Hooks
  const {
    editor: { linkCheck: copy },
  } = useCopy(menusContent)

  // Early returns
  if (count === 0) return null

  // Render logic
  return (
    <div
      role="status"
      className="flex items-start gap-3 border-line border-b bg-warning-soft px-5 py-3 text-body"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-ink-strong">{copy.heading(count)}</span>
        <span className="text-caption text-muted-foreground">{copy.body}</span>
      </div>
    </div>
  )
}
