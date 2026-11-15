'use client'

import type { ChannelState } from '@commerce/core/sales-channels'
import { TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'

type RejectedItemsProps = {
  state: ChannelState
  name: string
}

/** Products the platform refused after the last sync (Google disapproved, Meta rejected). */
export default function RejectedItems({ state, name }: RejectedItemsProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent)

  // Early returns
  const count = state.sync.rejected ?? 0
  if (count === 0) return null

  // Render logic
  const items = state.sync.rejectedItems

  return (
    <Alert tone="warning">
      <TriangleAlert />
      <AlertTitle>{copy.bar.rejected(count, name)}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1.5">
        <span>{copy.bar.rejectedHelp}</span>
        {items.length ? (
          <ul className="flex flex-col gap-0.5 text-caption text-foreground">
            {items.map((item) => (
              <li key={item.id} className="break-words">
                {copy.bar.rejectedItem(item.id, item.reason)}
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
