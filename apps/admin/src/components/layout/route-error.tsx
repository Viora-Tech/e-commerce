'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import { layoutContent } from '@/data/layout'
import { useCopy } from '@/hooks/use-copy'

type RouteErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/** Shared body for every `error.tsx`: what went wrong, one retry. */
export default function RouteError({ error, reset }: RouteErrorProps) {
  // Hooks
  const layoutCopy = useCopy(layoutContent)
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageBody>
      <EmptyState
        icon={CircleAlert}
        heading={layoutCopy.error.heading}
        body={error.message || layoutCopy.error.body}
        action={
          <Button variant="outline" onClick={reset}>
            {layoutCopy.error.retry}
          </Button>
        }
      />
    </PageBody>
  )
}
