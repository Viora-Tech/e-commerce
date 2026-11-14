'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import PageBody from '@/components/layout/page-body'
import PageState from '@/components/states/page-state'
import { statesContent } from '@/data/states'
import { useCopy } from '@/hooks/use-copy'
import type { LoadFailure } from '@/hooks/use-load'

type ServerLoadFailedProps = {
  /** Why the server page's read failed (`loadFailure(error)` in `lib/load-failure.ts`). */
  failed: LoadFailure
  /** "Could not load themes": what did not load. */
  heading: string
}

/**
 * A server page whose read failed: "Could not load …" with Try again, which asks the server for
 * the page again (`router.refresh`) and spins while it does; or "You do not have access" when
 * the member's role does not allow the read (no retry, since the answer would be the same).
 * The client-read twin is `LoadFailed` (`useLoad`).
 */
export default function ServerLoadFailed({ failed, heading }: ServerLoadFailedProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(statesContent)
  const [retrying, startRetry] = useTransition()

  // Event handlers
  const handleRetry = () => startRetry(() => router.refresh())

  // Render logic
  return (
    <PageBody>
      {failed === 'no-access' ? (
        <PageState kind="no-access" />
      ) : (
        <PageState
          kind="error"
          heading={heading}
          action={
            <Button loading={retrying} onClick={handleRetry}>
              {copy.error.retry}
            </Button>
          }
        />
      )}
    </PageBody>
  )
}
