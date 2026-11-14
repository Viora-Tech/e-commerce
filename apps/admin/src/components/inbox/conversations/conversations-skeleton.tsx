import { Skeleton } from '@commerce/ui/shadcn/skeleton'

/** The three-pane frame: one card as tall as the screen under the top bar. */
export const CONVERSATIONS_FRAME =
  'flex h-[calc(100dvh-6.5rem)] min-h-[30rem] overflow-hidden rounded-lg surface-card'

/**
 * Conversations while the route loads: the same frame with the views rail, the list pane (search
 * and three rows, as the list draws while it reads) and an empty thread pane.
 */
export default function ConversationsSkeleton() {
  // Render logic
  return (
    <div className={CONVERSATIONS_FRAME} aria-busy="true">
      <div className="hidden w-52 shrink-0 flex-col gap-2 border-r border-hairline p-3 lg:flex">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex w-full shrink-0 flex-col border-r border-hairline md:w-80">
        <div className="border-b border-hairline p-3">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 md:flex" />
    </div>
  )
}
