import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import SegmentsList from '@/components/customers/segments-list'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { segmentsContent as copy } from '@/data/customers'
import { appRouter, call, serverContext } from '@/lib/api'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: 'Segments' }

export default async function Page() {
  const context = await serverContext()
  const segments = await call(appRouter.customers.segments, undefined, { context }).catch(
    orNoStore(undefined),
  )
  if (segments === undefined) redirect('/select-store')

  return (
    <PageBody className="gap-6">
      <PageHeader
        title={copy.heading}
        subtitle={copy.intro}
        actions={
          <Button size="sm" render={<Link href="/customers/segments/new" />}>
            <Plus />
            {copy.create}
          </Button>
        }
      />
      <SegmentsList segments={segments} />
    </PageBody>
  )
}
