import { customerDataRequests } from '@commerce/core'
import type { Metadata } from 'next'
import AccountPageHead from '@/components/account/account-page-head'
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
    <>
      <AccountPageHead title={privacyContent.title} intro={privacyContent.intro} />
      <div className="flex max-w-[40rem] flex-col gap-4 sm:gap-5">
        <DataRequests requests={requests} timeZone={timeZone} />
        {deletionPending ? null : <DeleteAccount />}
      </div>
    </>
  )
}
