'use client'

import { useRouter } from 'next/navigation'
import PageBody from '@/components/layout/page-body'
import PageState from '@/components/states/page-state'
import type { ReadFailure } from './server-read'

type ReadFailedPageProps = {
  failure: ReadFailure
  /** "Could not load sales channels". */
  heading: string
  /** The words for a role that may not see the page (the default no-access words otherwise). */
  noAccess?: { heading: string; body: string }
}

/**
 * A Sales channels or Inbox page whose server read failed: "Could not load …" with Try again
 * (which reads the page again), or no-access, with no retry, when the member's role does not
 * allow it.
 */
export default function ReadFailedPage({ failure, heading, noAccess }: ReadFailedPageProps) {
  // Hooks
  const router = useRouter()

  // Render logic
  return (
    <PageBody>
      {failure === 'no-access' ? (
        <PageState kind="no-access" heading={noAccess?.heading} body={noAccess?.body} />
      ) : (
        <PageState kind="error" heading={heading} onRetry={() => router.refresh()} />
      )}
    </PageBody>
  )
}
