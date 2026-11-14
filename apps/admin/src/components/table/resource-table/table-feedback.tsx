'use client'

import { CircleAlert, RotateCcw, SearchX } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import EmptyState from '@/components/layout/empty-state'
import { statesContent } from '@/data/states'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

type Words = { heading: string; body?: string | undefined; action?: ReactNode }

type TableFeedbackProps = {
  /** `error`: the rows could not be read; `noResults`: a search or filter found nothing; `empty`: none yet. */
  kind: 'error' | 'noResults' | 'empty'
  plural: string
  /** The page's own words for this state; the table's generic ones otherwise. */
  words?: Partial<Words> | undefined
  /** `error`: reads the rows again. */
  onRetry?: (() => void) | undefined
  /** `noResults`: clears the search and every filter. */
  onClear?: (() => void) | undefined
}

/**
 * What the table body shows instead of rows, inside the table card under its header row: a
 * failed read with Try again, "No results" with Clear filters (Figma "Feedback state · No
 * results"), or the list's empty state. All three are the one EmptyState.
 */
export default function TableFeedback({
  kind,
  plural,
  words,
  onRetry,
  onClear,
}: TableFeedbackProps) {
  // Hooks
  const tableCopy = useCopy(tableContent)
  const states = useCopy(statesContent)

  // Early returns
  if (kind === 'error') {
    return (
      <EmptyState
        icon={CircleAlert}
        tone="danger"
        heading={words?.heading ?? tableCopy.loadFailed(plural)}
        body={words?.body ?? states.error.body}
        action={
          words?.action ??
          (onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              {states.error.retry}
            </Button>
          ) : null)
        }
      />
    )
  }

  if (kind === 'noResults') {
    return (
      <EmptyState
        icon={SearchX}
        heading={words?.heading ?? tableCopy.noResults}
        body={words?.body ?? tableCopy.noResultsBody}
        action={
          words?.action ?? (
            <Button variant="outline" onClick={onClear}>
              {tableCopy.clearSearchAndFilters}
            </Button>
          )
        }
      />
    )
  }

  // Render logic
  return (
    <EmptyState
      heading={words?.heading ?? tableCopy.emptyHeading(plural)}
      body={words?.body}
      action={words?.action}
    />
  )
}
