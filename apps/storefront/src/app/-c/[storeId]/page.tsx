import { liveThemeSettings } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ChatFrame from '@/components/inbox/chat-frame'
import { inboxLauncherOf } from '@/lib/inbox-launcher'
import { chatLogoUrl } from '@/lib/inbox-logo'
import { liquidLayoutFor } from '@/lib/liquid-theme'
import { storeRead } from '@/lib/store-cache'
import { liveThemeId } from '@/lib/template-render'

type Params = { params: Promise<{ storeId: string }> }

/** What the chat card needs from the store row, cached per store version. */
function storeRow(storeId: string) {
  return storeRead(storeId, 'chat-frame-store', async (tx) => {
    const [s] = await tx
      .select({ name: store.name, preferences: store.preferences, apps: store.apps })
      .from(store)
      .where(eq(store.id, storeId))
    return s ?? null
  })
}

/** The Inbox chat card for a plain HTML page's chat frame; 404 when the chat is off. */
export default async function ChatFramePage({ params }: Params) {
  const { storeId } = await params
  const current = await storeRow(storeId)
  const widget = current ? inboxLauncherOf(current.apps) : null

  if (!current || !widget) notFound()
  const themeId = await liveThemeId(storeId)
  const theme = await storeRead(storeId, 'live-theme-settings', (tx) =>
    liveThemeSettings(tx, storeId),
  )
  const logoUrl = await chatLogoUrl({
    storeId,
    themeId,
    liquid: themeId ? (await liquidLayoutFor(storeId, themeId)) !== null : false,
    themeLogo: theme.brand.logo?.url,
    preferences: current.preferences,
    favicon: theme.brand.favicon?.url,
  })
  return <ChatFrame widget={widget} storeName={current.name} logoUrl={logoUrl} />
}
