import { settingsSecret } from '@commerce/config'
import {
  AFFILIATE_PORTAL_PATH,
  enrolOffer,
  enrolOrderId,
  rewardLabel,
} from '@commerce/plugin-affiliates/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import AffiliateJoin from '@/components/affiliate/affiliate-join'
import { affiliateContent } from '@/data/affiliate'
import { requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'

type JoinPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ t?: string | string[] }>
}

const copy = affiliateContent.join

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
}

/**
 * Share and earn (Affiliates app): the invite a buyer opens from their order. Nothing happens
 * until they tap the button, so a link scanner opening the email never makes an affiliate.
 */
export default async function AffiliateJoinPage({ params, searchParams }: JoinPageProps) {
  const { storeId } = await params
  const { t } = await searchParams
  const token = typeof t === 'string' ? t : ''
  const orderId = enrolOrderId(token, storeId, settingsSecret())
  const [offer, origin] = await Promise.all([
    orderId ? inStore(storeId, (tx) => enrolOffer(tx, storeId, orderId)) : null,
    requestOrigin(),
  ])

  // Early returns
  if (!offer || (offer.existing && offer.existing.status !== 'approved'))
    return (
      <section className="page-width flex flex-col items-start gap-4 py-10 md:py-14">
        <h1 className="h2">{copy.title}</h1>
        <p className="text-body text-muted">{copy.invalid}</p>
        <Link href="/" className="btn btn--secondary">
          <span className="btn__label">{copy.shop}</span>
        </Link>
      </section>
    )
  if (offer.existing)
    return (
      <section className="page-width flex flex-col items-start gap-4 py-10 md:py-14">
        <h1 className="h2">{copy.title}</h1>
        <p className="text-body">{copy.already}</p>
        <Link href={AFFILIATE_PORTAL_PATH} className="btn btn--primary">
          <span className="btn__label">{copy.dashboard}</span>
        </Link>
      </section>
    )

  // Render logic
  return (
    <section className="page-width flex flex-col gap-6 py-10 md:py-14">
      <header className="flex max-w-[40rem] flex-col gap-3">
        <h1 className="h2">{copy.title}</h1>
        <p className="text-body">{copy.body(rewardLabel(offer.settings.commission))}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
          <li>{copy.points.link}</li>
          <li>{copy.points.paid}</li>
        </ul>
      </header>
      <AffiliateJoin token={token} origin={origin} />
    </section>
  )
}
