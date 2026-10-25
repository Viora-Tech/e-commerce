import {
  isLive,
  isMetaChannel,
  isSocialChannel,
  type MetaChannel,
} from '@commerce/core/sales-channels'
import { SocialMedia } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import SectionEmpty from '@/components/layout/section-empty'
import SocialChannelPage from '@/components/sales-channels/social-channel-page'
import { salesChannelsContent } from '@/data/sales-channels'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'

type PageProps = {
  params: Promise<{ channel: string }>
  /** `surface`: the Meta tab; `connect`: how a Meta or Google sign-in went (the page toasts it). */
  searchParams: Promise<{ surface?: string | string[]; connect?: string | string[] }>
}

/** `/social/meta` is Facebook, Instagram and WhatsApp on one page; Google keeps its own. */
const META = 'meta'

type Context = Awaited<ReturnType<typeof serverContext>>

/** One channel's page data; null when the store cannot show it. */
const loadSocial = (context: Context, channel: MetaChannel | 'google') =>
  call(appRouter.salesChannels.social, { channel }, { context }).catch(() => null)

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { channel } = await params
  if (channel === META) return { title: salesChannelsContent.socialPage.meta.navTitle }
  return {
    title: isSocialChannel(channel) ? salesChannelsContent.social[channel].name : 'Social media',
  }
}

export default async function Page({ params, searchParams }: PageProps) {
  const { channel } = await params
  const { surface, connect } = await searchParams
  // Old links (`/social/instagram`, Meta's own callback) land on the Meta page's tab.
  if (isMetaChannel(channel)) {
    const to = new URLSearchParams({ surface: channel })
    if (typeof connect === 'string') to.set('connect', connect)
    redirect(`${routes.salesChannels.socialMeta()}?${to}`)
  }
  if (channel !== META && !isSocialChannel(channel)) notFound()
  const context = await serverContext()
  const asked = isMetaChannel(surface) ? surface : null
  const [first, readiness, copy] = await Promise.all([
    loadSocial(context, channel === META ? (asked ?? 'facebook') : (channel as 'google')),
    call(appRouter.salesChannels.readiness, undefined, { context }).catch(() => null),
    getCopy(salesChannelsContent.unavailable),
  ])
  // No tab asked for: open the first Meta surface that is on.
  const on = first?.meta.find((s) => isLive(s.state) && s.state.status !== 'disconnected')
  const data =
    channel === META && !asked && on && on.channel !== first?.channel
      ? await loadSocial(context, on.channel)
      : first

  if (!data) return <SectionEmpty {...copy} icon={SocialMedia} />
  return <SocialChannelPage data={data} issues={readiness?.issues ?? []} />
}
