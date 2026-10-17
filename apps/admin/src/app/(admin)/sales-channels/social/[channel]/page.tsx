import { isSocialChannel } from '@commerce/core/sales-channels'
import { SocialMedia } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SectionEmpty from '@/components/layout/section-empty'
import SocialChannelPage from '@/components/sales-channels/social-channel-page'
import { salesChannelsContent } from '@/data/sales-channels'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

type PageProps = { params: Promise<{ channel: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { channel } = await params
  return {
    title: isSocialChannel(channel) ? salesChannelsContent.social[channel].name : 'Social media',
  }
}

export default async function Page({ params }: PageProps) {
  const { channel } = await params
  if (!isSocialChannel(channel)) notFound()
  const context = await serverContext()
  const [data, readiness, copy] = await Promise.all([
    call(appRouter.salesChannels.social, { channel }, { context }).catch(() => null),
    call(appRouter.salesChannels.readiness, undefined, { context }).catch(() => null),
    getCopy(salesChannelsContent.unavailable),
  ])

  if (!data) return <SectionEmpty {...copy} icon={SocialMedia} />
  return <SocialChannelPage data={data} issues={readiness?.issues ?? []} />
}
