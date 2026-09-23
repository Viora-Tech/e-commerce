import type { Metadata } from 'next'
import CampaignEditor from '@/components/marketing/campaigns/campaign-editor'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'New campaign' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const kind = (await searchParams).kind === 'whatsapp' ? 'whatsapp' : 'email'
  const context = await serverContext()
  const [setup, me] = await Promise.all([
    call(appRouter.marketing.setup, undefined, { context }),
    call(appRouter.me, undefined, { context }),
  ])
  return (
    <CampaignEditor
      campaign={null}
      kind={kind}
      segments={setup.segments}
      storeName={setup.storeName}
      storefrontUrl={setup.storefrontUrl}
      merchantEmail={me?.user.email ?? ''}
      setup={setup}
    />
  )
}
