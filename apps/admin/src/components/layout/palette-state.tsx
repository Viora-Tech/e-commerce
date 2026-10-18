'use client'

import { AiIcon, CircleAlert, Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import EmptyState from '@/components/layout/empty-state'
import { paletteContent } from '@/data/command-palette'
import { useCopy } from '@/hooks/use-copy'

type PaletteStateProps =
  | { kind: 'loading' }
  | { kind: 'empty'; query: string; onAskAi: (() => void) | null }
  | { kind: 'error'; onRetry: () => void }

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

/** What the list shows instead of rows: placeholders while searching, nothing found, or a failure. */
export default function PaletteState(props: PaletteStateProps) {
  // Hooks
  const copy = useCopy(paletteContent)

  // Early returns
  if (props.kind === 'loading') {
    return (
      <div aria-hidden="true" className="flex flex-col gap-1 p-2">
        {SKELETON_ROWS.map((id) => (
          <div key={id} className="flex items-center gap-3 px-3 py-2">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (props.kind === 'error') {
    return (
      <EmptyState
        icon={CircleAlert}
        tone="danger"
        heading={copy.error.title}
        body={copy.error.body}
        className="py-10"
        action={
          <Button size="sm" variant="key-neutral" onClick={props.onRetry}>
            {copy.error.retry}
          </Button>
        }
      />
    )
  }

  // Render logic
  const { query, onAskAi } = props

  return (
    <EmptyState
      icon={Search}
      heading={copy.noResults(query)}
      body={copy.noResultsBody}
      className="py-10"
      action={
        <div className="flex flex-col items-center gap-3">
          {onAskAi ? (
            <Button size="sm" onClick={onAskAi}>
              <AiIcon aria-hidden />
              {copy.askAi(query)}
            </Button>
          ) : null}
          <ul className="flex flex-col gap-1 text-caption text-muted-foreground">
            {copy.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      }
    />
  )
}
