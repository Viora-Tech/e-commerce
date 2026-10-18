import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import SegmentsList from '@/components/customers/segments-list'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
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
    <PageBody width="frame" className="gap-6">
      <PageHeader
        title={copy.title}
        summary={copy.summary(segments.length)}
        back={{ label: copy.back, href: routes.customers.list() }}
        actions={
          <Button render={<Link href={routes.customers.newSegment()} />} nativeButton={false}>
            <Plus />
            {copy.create}
          </Button>
        }
      />
      <SegmentsList segments={segments} />
    </PageBody>
  )
}
