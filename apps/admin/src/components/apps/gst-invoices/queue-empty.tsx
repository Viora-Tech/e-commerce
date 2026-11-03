'use client'

import type { IssueOn } from '@commerce/invoices'
import { ReceiptIcon, Settings } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import { gstQueueEmptyContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type QueueEmptyProps = {
  /** The store's "Queue orders" setting; null while it loads. */
  issueOn: IssueOn | null
  /** A date range is set, so the queue may hold orders outside it. */
  filtered: boolean
}

/** The invoice queue with nothing in it: what it holds, how orders arrive and what to do next. */
export default function QueueEmpty({ issueOn, filtered }: QueueEmptyProps) {
  // Hooks
  const copy = useCopy(gstQueueEmptyContent)

  // Early returns
  if (filtered) return <EmptyState variant="plain" size="lg" body={copy.filtered} />

  // Render logic
  const body = [copy.body, issueOn ? copy.when[issueOn] : null, copy.next].filter(Boolean).join(' ')

  return (
    <EmptyState
      icon={ReceiptIcon}
      heading={copy.heading}
      body={body}
      action={
        <>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.apps.page('gst-invoices', 'settings')} />}
          >
            <Settings aria-hidden="true" />
            {copy.settings}
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href={routes.orders.list()} />}
          >
            {copy.orders}
          </Button>
        </>
      }
    />
  )
}
