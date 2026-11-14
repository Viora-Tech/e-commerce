'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
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
    // The warning banner as a strip across the top of the menu card (flush with its edges).
    <Alert
      tone="warning"
      role="status"
      className="rounded-none border-x-0 border-t-0 px-5 text-body"
    >
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{copy.heading(count)}</AlertTitle>
      <AlertDescription className="text-caption">{copy.body}</AlertDescription>
    </Alert>
  )
}
