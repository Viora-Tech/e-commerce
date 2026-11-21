import { parsePreferences, primaryStoreHostname, searchIndexable } from '@commerce/core'
import {
  AGENT_BOTS,
  type AgentProbe,
  type AgentReadinessReport,
  agentReadiness,
  type Fetched,
} from '@commerce/core/agent-readiness'
import { readCapped, safeFetch } from '@commerce/core/safe-fetch'
import type { StoreTx } from '@commerce/db'
import { product, store, variant } from '@commerce/db'
import { and, countDistinct, eq, isNull, or, sql } from 'drizzle-orm'

/** Each request's own limit; the check sends ten requests in two parallel rounds. */
const TIMEOUT_MS = 8_000
/** A product page is a few hundred KB; anything past this is not read. */
const MAX_BYTES = 3_000_000
/** How Store health introduces itself to the store's own site. */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 KoomerceStoreHealth/1.0'

const decoder = new TextDecoder()

/** One GET (or the MCP POST), never throwing: a failure is `status: null`. */
async function probe(
  url: string,
  opts: { ua?: string; body?: string; read?: boolean } = {},
): Promise<Fetched> {
  try {
    const res = await safeFetch(url, {
      timeoutMs: TIMEOUT_MS,
      headers: {
        'user-agent': opts.ua ?? BROWSER_UA,
        ...(opts.body ? { 'content-type': 'application/json', accept: 'application/json' } : {}),
      },
      ...(opts.body ? { method: 'POST', body: opts.body } : {}),
    })
    const contentType = res.headers.get('content-type')
    if (opts.read === false) {
      await res.body?.cancel()
      return { status: res.status, contentType }
    }
    const bytes = await readCapped(res, MAX_BYTES)
    return { status: res.status, contentType, body: bytes ? decoder.decode(bytes) : null }
  } catch {
    return { status: null }
  }
}

/** The tool names the store's MCP endpoint lists (read-only `tools/list`); null when it fails. */
function mcpTools(answer: Fetched): string[] | null {
  if (answer.status !== 200 || !answer.body) return null
  try {
    const reply = JSON.parse(answer.body) as { result?: { tools?: { name?: unknown }[] } }
    return (reply.result?.tools ?? []).flatMap((t) => (typeof t.name === 'string' ? [t.name] : []))
  } catch {
    return null
  }
}

/** Active products with a live variant that has neither a SKU nor a barcode. */
async function productsNoSku(tx: StoreTx): Promise<number> {
  const blank = (col: typeof variant.sku | typeof variant.barcode) =>
    or(isNull(col), eq(sql`trim(${col})`, ''))
  const [row] = await tx
    .select({ products: countDistinct(variant.productId) })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        eq(product.status, 'active'),
        eq(product.isSystemTest, false),
        eq(product.isGiftCard, false),
        isNull(variant.archivedAt),
        eq(variant.hiddenOnStore, false),
        blank(variant.sku),
        blank(variant.barcode),
      ),
    )
  return row?.products ?? 0
}

/**
 * Settings → Store health › AI shopping agents: fetch the store's live site as a browser and as
 * AI bots (GET only, plus one read-only MCP `tools/list`) and grade it (`agentReadiness`). Null
 * when the store has no live domain of its own yet: there is no public site to check.
 */
export async function agentReadinessCheck(
  tx: StoreTx,
  storeId: string,
  now: Date = new Date(),
): Promise<AgentReadinessReport | null> {
  const hostname = await primaryStoreHostname(tx, storeId)
  // A development store's `*.localhost` is no public site either.
  if (!hostname || /(^|\.)localhost$/.test(hostname)) return null
  const [s] = await tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  const prefs = parsePreferences(s?.preferences)
  const facts = {
    aiAllowed: searchIndexable(prefs) && prefs.indexing.aiCrawlers,
    productsNoSku: await productsNoSku(tx),
  }
  const origin = `https://${hostname}`
  // Two rounds of parallel requests (the product page needs the sitemap first), so the request's
  // transaction waits a few seconds at most, never a dozen requests in a row.
  const [robots, llms, sitemap, feed, tools] = await Promise.all([
    probe(`${origin}/robots.txt`),
    probe(`${origin}/llms.txt`),
    probe(`${origin}/sitemap.xml`),
    probe(`${origin}/products.json?limit=1`, { read: false }),
    probe(`${origin}/api/mcp`, {
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }),
  ])
  const first = sitemap.body?.match(/<loc>([^<]*\/products\/[^<]+)<\/loc>/)?.[1]
  const productUrl = first && new URL(first).origin === origin ? first : null
  const target = productUrl ?? `${origin}/`
  const [page, markdown, ...botAnswers] = await Promise.all([
    productUrl ? probe(productUrl) : null,
    productUrl ? probe(`${productUrl.replace(/[?#].*$/, '')}.md`) : null,
    ...AGENT_BOTS.map((bot) => probe(target, { ua: bot.ua, read: false })),
  ])
  const bots = AGENT_BOTS.map((bot, i) => ({
    name: bot.name,
    status: botAnswers[i]?.status ?? null,
  }))
  const result: AgentProbe = {
    origin,
    robots,
    llms,
    sitemap,
    product: page && productUrl ? { ...page, url: productUrl } : null,
    bots,
    markdown,
    feed,
    mcpTools: mcpTools(tools),
  }
  return agentReadiness(result, facts, now)
}
