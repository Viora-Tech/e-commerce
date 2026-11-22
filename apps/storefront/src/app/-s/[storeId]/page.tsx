import { liveThemeSettings, parsePreferences } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import JsonLd from '@/components/seo/json-ld'
import { marketCanonical, requestOrigin, socialProfiles, storeGraph } from '@/lib/seo'
import { storeRead } from '@/lib/store-cache'
import { renderTemplate } from '@/lib/template-render'

type Params = { params: Promise<{ storeId: string }> }

// Title, description and social image come from the layout (Online Store > Preferences).
export async function generateMetadata(): Promise<Metadata> {
  return { alternates: { canonical: await marketCanonical('/') } }
}

export default async function Home({ params }: Params) {
  const { storeId } = await params
  const origin = await requestOrigin()
  const [identity, page] = await Promise.all([
    storeRead(storeId, 'home-identity', async (tx) => {
      const [s] = await tx.select().from(store).where(eq(store.id, storeId))
      const theme = await liveThemeSettings(tx, storeId)
      return {
        name: s?.name ?? '',
        logoUrl: theme.brand.logo?.url,
        sameAs: socialProfiles(theme.social.links),
        description: parsePreferences(s?.preferences).seo.description || undefined,
        email: s?.contactEmail,
        phone: s?.contactPhone,
      }
    }),
    renderTemplate(storeId, 'home'),
  ])
  // The sections come first so a theme's `main > section:first-child` rules (the hero
  // painting without a reveal) see the first section, as on Shopify.
  return (
    <>
      {page}
      <JsonLd data={storeGraph({ ...identity, origin })} />
    </>
  )
}
