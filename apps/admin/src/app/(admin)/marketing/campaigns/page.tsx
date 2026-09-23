import type { Metadata } from 'next'
import CampaignsPage from '@/components/marketing/campaigns/campaigns-page'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Campaigns' }

export default async function Page() {
  const context = await serverContext()
  const campaigns = await call(appRouter.marketing.campaigns.list, {}, { context })
  return <CampaignsPage campaigns={campaigns} />
}
