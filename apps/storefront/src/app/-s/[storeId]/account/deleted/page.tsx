import type { Metadata } from 'next'
import Link from 'next/link'
import AccountFrame from '@/components/account/account-frame'
import { privacyContent } from '@/data/privacy'

type AccountDeletedPageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: privacyContent.deleted.title }

/** Where a shopper lands after confirming their account deletion; they are signed out. */
export default async function AccountDeletedPage({ params }: AccountDeletedPageProps) {
  const { storeId } = await params
  const copy = privacyContent.deleted
  return (
    <AccountFrame storeId={storeId}>
      <div className="mx-auto flex max-w-[30rem] flex-col gap-4 py-12 text-center">
        <h1 className="h2">{copy.title}</h1>
        <p className="text-body text-muted">{copy.body}</p>
        <Link href="/" className="btn btn--primary mx-auto">
          <span className="btn__label">{copy.home}</span>
        </Link>
      </div>
    </AccountFrame>
  )
}
