import { parsePreferences } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { requestOrigin } from '@/lib/seo'
import { llmsTxt, loadStoreIndex } from '@/lib/seo-files'
import { inStore } from '@/lib/store-context'
import { storefrontLock } from '@/lib/storefront-gate'

type Params = { params: Promise<{ storeId: string }> }

// Per host and per request: never prerendered at build time.
export const dynamic = 'force-dynamic'

/** llms.txt for AI assistants and answer engines: the store as a Markdown link map. */
export async function GET(_req: Request, { params }: Params) {
  const { storeId } = await params
  if ((await storefrontLock(storeId)).enabled) return new Response('Not found', { status: 404 })
  const { name, description, index } = await inStore(storeId, async (tx) => {
    const [s] = await tx
      .select({ name: store.name, preferences: store.preferences })
      .from(store)
      .where(eq(store.id, storeId))
    return {
      name: s?.name ?? '',
      description: parsePreferences(s?.preferences).seo.description,
      index: await loadStoreIndex(tx),
    }
  })
  return new Response(llmsTxt(await requestOrigin(), { name, description }, index), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
