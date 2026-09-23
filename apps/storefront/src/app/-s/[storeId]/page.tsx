import { liveThemeSettings, parsePreferences } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { jsonLd, requestOrigin, storeGraph } from '@/lib/seo'
import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'

type Params = { params: Promise<{ storeId: string }> }

// Title, description and social image come from the layout (Online Store > Preferences).
export const metadata: Metadata = { alternates: { canonical: '/' } }

export default async function Home({ params }: Params) {
  const { storeId } = await params
  const origin = await requestOrigin()
  const { identity, page } = await inStore(storeId, async (tx) => {
    const [s] = await tx.select().from(store).where(eq(store.id, storeId))
    const theme = await liveThemeSettings(tx, storeId)
    const seo = parsePreferences(s?.preferences).seo
    return {
      identity: {
        name: s?.name ?? '',
        origin,
        logoUrl: theme.brand.logo?.url,
        description: seo.description || undefined,
        email: s?.contactEmail,
        phone: s?.contactPhone,
      },
      page: await renderTemplate(tx, storeId, 'home'),
    }
  })
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data; jsonLd() escapes it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(storeGraph(identity))} />
      {page}
    </>
  )
}
