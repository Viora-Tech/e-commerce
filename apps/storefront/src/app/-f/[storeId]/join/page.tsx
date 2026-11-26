import { settingsSecret } from '@commerce/config'
import { enrolOffer, enrolOrderId, rewardLabel } from '@commerce/plugin-affiliates/server'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import type { Metadata } from 'next'
import Link from 'next/link'
import AuthFrame from '@/components/affiliate-portal/auth-frame'
import JoinInvite from '@/components/affiliate-portal/join-invite'
import { affiliateContent } from '@/data/affiliate'
import { portalBase, portalHref, portalStore } from '@/lib/affiliate-portal'
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
 * Share and earn (Affiliates app): the invite a buyer opens from their order
 * (`/affiliate/join?t=`). Nothing happens until they tap the button, so a link scanner opening
 * the email never makes an affiliate.
 */
export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  // Hooks
  const { storeId } = await params
  const { t } = await searchParams
  const token = typeof t === 'string' ? t : ''
  const orderId = enrolOrderId(token, storeId, settingsSecret())
  const [offer, store, base] = await Promise.all([
    orderId ? inStore(storeId, (tx) => enrolOffer(tx, storeId, orderId)) : null,
    portalStore(storeId),
    portalBase(),
  ])

  // Helpers
  const home = portalHref(base, '/')

  // Render logic
  const invalid = !offer || (offer.existing && offer.existing.status !== 'approved')
  return (
    <AuthFrame store={store}>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>
            {invalid
              ? copy.invalid
              : offer.existing
                ? copy.already
                : copy.body(rewardLabel(offer.settings.commission))}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {invalid ? (
            <Button variant="outline" nativeButton={false} render={<a href={store.origin} />}>
              {copy.shop}
            </Button>
          ) : offer.existing ? (
            <Button nativeButton={false} render={<Link href={home} />}>
              {copy.dashboard}
            </Button>
          ) : (
            <>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                <li>{copy.points.link}</li>
                <li>{copy.points.paid}</li>
              </ul>
              <JoinInvite token={token} origin={store.origin} dashboard={home} />
            </>
          )}
        </CardContent>
      </Card>
    </AuthFrame>
  )
}
