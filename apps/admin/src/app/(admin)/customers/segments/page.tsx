import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import CustomersBackLink from '@/components/customers/customers-back-link'
import SegmentsList from '@/components/customers/segments-list'
import PageBody from '@/components/layout/page-body'
import { segmentsContent } from '@/data/customers'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: 'Segments' }

export default async function Page() {
  const copy = await getCopy(segmentsContent)
  const context = await serverContext()
  const segments = await call(appRouter.customers.segments, undefined, { context }).catch(
    orNoStore(undefined),
  )
  if (segments === undefined) redirect(routes.selectStore())

  return (
    <PageBody width="frame" className="max-w-[77.5rem] gap-6 md:mx-auto">
      <div className="flex flex-col gap-3">
        <CustomersBackLink href={routes.customers.list()} label={copy.back} />
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-page-title text-ink-strong">{copy.title}</h1>
            <p className="text-body text-muted-foreground">{copy.summary(segments.length)}</p>
          </div>
          <Button render={<Link href={routes.customers.newSegment()} />} nativeButton={false}>
            <Plus />
            {copy.create}
          </Button>
        </div>
      </div>
      <SegmentsList segments={segments} />
    </PageBody>
  )
}
