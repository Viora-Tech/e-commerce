import { LoyaltyLanding, loyaltyWidgetContent } from '@commerce/blocks/loyalty'
import { loyaltyState } from '@commerce/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loyaltyViewFor, storeBrandFor, storeNameFor } from '@/lib/loyalty-view'
import { requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'

type RewardsPageProps = { params: Promise<{ storeId: string }> }

export async function generateMetadata({ params }: RewardsPageProps): Promise<Metadata> {
  const { storeId } = await params
  return { title: loyaltyWidgetContent.programName(await storeNameFor(storeId)) }
}

/**
 * The Loyalty points app's landing page (Placements → Embedded content → Loyalty landing page):
 * how the program works, the ways to earn and redeem, the referral offer and a short FAQ, inside
 * the store's theme. A menu links to it at `/pages/rewards`. Missing without the app, or when
 * the merchant switched the page off.
 */
export default async function RewardsPage({ params }: RewardsPageProps) {
  const { storeId } = await params
  const state = await inStore(storeId, (tx) => loyaltyState(tx, storeId))
  if (!state.installed || !state.settings.pages.landing) notFound()
  const [view, brand] = await Promise.all([
    loyaltyViewFor(storeId, await requestOrigin()),
    storeBrandFor(storeId).catch(() => null),
  ])
  if (!view?.live) notFound()
  return (
    <section className="page-width">
      <LoyaltyLanding view={view} brand={brand} expiryMonths={state.settings.expiryMonths} />
    </section>
  )
}
