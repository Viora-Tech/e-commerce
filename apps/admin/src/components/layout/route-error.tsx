'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { CircleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { EmptyState } from '@/components/layout/empty-state'
import { PageBody } from '@/components/layout/page-body'
import { layoutContent } from '@/data/layout'

type RouteErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/** Shared body for every `error.tsx`: what went wrong, one retry. */
export function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageBody>
      <EmptyState
        icon={CircleAlert}
        heading={layoutContent.error.heading}
        body={error.message || layoutContent.error.body}
        action={
          <Button variant="outline" onClick={reset}>
            {layoutContent.error.retry}
          </Button>
        }
      />
    </PageBody>
  )
}
