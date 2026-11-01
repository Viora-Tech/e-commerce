import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import CampaignForm from '@/components/preorders/campaign-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: 'Pre-order campaign' }

type Params = { params: Promise<{ id: string }> }

/** A missing campaign (another store's, or a malformed id) is a 404, not an error page. */
const missing = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'NOT_FOUND' || code === 'BAD_REQUEST') return null
  return orNoStore(undefined)(error)
}

export default async function Page({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const campaign = await call(appRouter.preorders.campaigns.get, { id }, { context }).catch(missing)
  if (campaign === undefined) redirect(routes.selectStore())
  if (!campaign) notFound()
  const { markets, locations } = await call(appRouter.preorders.overview, undefined, { context })
  return (
    <CampaignForm
      key={`${campaign.id}-${campaign.updatedAt.toString()}`}
      campaign={campaign}
      markets={markets}
      locations={locations}
    />
  )
}
