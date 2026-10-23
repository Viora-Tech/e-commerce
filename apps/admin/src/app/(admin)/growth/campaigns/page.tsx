import type { Metadata } from 'next'
import CampaignsPage from '@/components/growth/campaigns/campaigns-page'
import CampaignsTabs from '@/components/growth/campaigns/campaigns-tabs'
import LinksPage from '@/components/growth/links/links-page'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Campaigns' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const { tab } = await searchParams
  if (tab === 'links') {
    return (
      <LinksPage
        storefrontOrigin={await storefrontOrigin()}
        tabs={<CampaignsTabs value="links" />}
      />
    )
  }
  const context = await serverContext()
  const [campaigns, performance] = await Promise.all([
    call(appRouter.marketing.campaigns.list, {}, { context }),
    call(appRouter.marketing.campaignPerformance, undefined, { context }),
  ])
  return (
    <CampaignsPage
      campaigns={campaigns}
      performance={performance}
      tabs={<CampaignsTabs value="campaigns" />}
    />
  )
}
