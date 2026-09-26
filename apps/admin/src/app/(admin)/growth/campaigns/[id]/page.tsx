import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CampaignEditor from '@/components/growth/campaigns/campaign-editor'
import CampaignReport from '@/components/growth/campaigns/campaign-report'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Campaign' }

type Props = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Drafts open in the editor; anything scheduled or sent opens its report. */
export default async function Page({ params }: Props) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const context = await serverContext()
  const [campaign, setup, me] = await Promise.all([
    call(appRouter.marketing.campaigns.get, { id }, { context }),
    call(appRouter.marketing.setup, undefined, { context }),
    call(appRouter.me, undefined, { context }),
  ])
  if (!campaign) notFound()
  if (campaign.status !== 'draft') {
    return (
      <CampaignReport
        campaign={campaign}
        storeName={setup.storeName}
        storefrontUrl={setup.storefrontUrl}
      />
    )
  }
  return (
    <CampaignEditor
      key={campaign.updatedAt.toString()}
      campaign={campaign}
      kind={campaign.kind}
      segments={setup.segments}
      storeName={setup.storeName}
      storefrontUrl={setup.storefrontUrl}
      merchantEmail={me?.user.email ?? ''}
      setup={setup}
    />
  )
}
