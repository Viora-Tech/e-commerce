'use client'

import { AiIcon, Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
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
      <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="text-body-strong text-foreground">{copy.error.title}</p>
        <p className="text-body text-muted-foreground">{copy.error.body}</p>
        <Button size="sm" variant="key-neutral" onClick={props.onRetry}>
          {copy.error.retry}
        </Button>
      </div>
    )
  }

  // Render logic
  const { query, onAskAi } = props

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Search className="size-5" />
      </span>
      <p className="text-body-strong break-all text-foreground">{copy.noResults(query)}</p>
      <p className="text-body text-muted-foreground">{copy.noResultsBody}</p>
      {onAskAi ? (
        <Button size="sm" onClick={onAskAi}>
          <AiIcon aria-hidden />
          {copy.askAi(query)}
        </Button>
      ) : null}
      <ul className="mt-1 flex flex-col gap-1 text-caption text-muted-foreground">
        {copy.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </div>
  )
}
