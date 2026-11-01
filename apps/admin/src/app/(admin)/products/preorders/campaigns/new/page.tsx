import type { Metadata } from 'next'
import CampaignForm from '@/components/preorders/campaign-form'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'New pre-order campaign' }

export default async function Page() {
  const context = await serverContext()
  // The overview carries the store's markets and locations the rules pick from.
  const { markets, locations } = await call(appRouter.preorders.overview, undefined, { context })
  return <CampaignForm campaign={null} markets={markets} locations={locations} />
}
