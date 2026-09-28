import { customerDataRequests } from '@commerce/core'
import type { Metadata } from 'next'
import DataRequests from '@/components/account/data-requests'
import DeleteAccount from '@/components/account/delete-account'
import { privacyContent } from '@/data/privacy'
import { storeTimeZone } from '@/lib/account'
import { requireCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'

type PrivacyPageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: privacyContent.title }

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { storeId } = await params
  const me = await requireCustomer(storeId, '/account/privacy')
  const { requests, timeZone } = await inStore(storeId, async (tx) => ({
    requests: await customerDataRequests({ tx, storeId }, me.id),
    timeZone: await storeTimeZone(tx, storeId),
  }))
  const deletionPending = requests.some(
    (r) => r.kind === 'delete' && (r.status === 'open' || r.status === 'in_progress'),
  )
  return (
    <div className="flex max-w-[36rem] flex-col gap-8">
      <p className="text-body text-muted">{privacyContent.intro}</p>
      <DataRequests requests={requests} timeZone={timeZone} />
      {deletionPending ? null : <DeleteAccount />}
    </div>
  )
}
