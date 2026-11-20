/** SOURCE OF TRUTH: AI shopping agent readiness — WHAT: the pass/fail checks Settings → Store health runs against the store's live site (bots let in, robots.txt, llms.txt, sitemap, product data in the HTML, variants, price tags, Markdown copy, product feed, MCP) / WHY: the is-agentic-storefront scan of waimers.in (20 Nov 2026, 73/100) showed agents miss what the HTML and robots.txt do not say, and a Cloudflare "Block AI bots" switch would hide the store from them without any error the merchant sees */

/*
 * Pure: the API's agent-readiness service fetches the live pages (GET, plus one read-only MCP
 * `tools/list`) and hands the answers in; this decides pass or fail. Modelled on the free
 * is-agentic-storefront.com checks (idea only; no code copied).
 */

export const AGENT_CHECK_IDS = [
  'bots_allowed',
  'robots_allows_ai',
  'llms_txt',
  'sitemap_products',
  'product_data',
  'product_variants',
  'price_tags',
  'markdown_copy',
  'product_feed',
  'mcp_endpoint',
  'products_have_sku',
] as const
export type AgentCheckId = (typeof AGENT_CHECK_IDS)[number]

/** AI search bots and assistants that fetch a page for a shopper (training crawlers left out). */
export const AGENT_BOTS = [
  { name: 'ClaudeBot', ua: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)' },
  {
    name: 'GPTBot',
    ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  },
  {
    name: 'PerplexityBot',
    ua: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  },
] as const

/** The robots.txt groups an AI search or shopping agent reads. */
export const ROBOTS_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
] as const

/** One fetched answer; `status` null when the request failed or timed out. */
export type Fetched = { status: number | null; contentType?: string | null; body?: string | null }

export type AgentProbe = {
  origin: string
  robots: Fetched
  llms: Fetched
  sitemap: Fetched
  /** The product page checked (the first product in the sitemap), fetched as a browser. */
  product: (Fetched & { url: string }) | null
  /** The same page fetched as each of `AGENT_BOTS`. */
  bots: { name: string; status: number | null }[]
  markdown: Fetched | null
  feed: Fetched
  /** `tools/list` names from the store's MCP endpoint; null when it did not answer. */
  mcpTools: string[] | null
}

export type AgentFacts = {
  /** Online store → Preferences lets AI crawlers in. */
  aiAllowed: boolean
  /** Active products with a variant that has neither a SKU nor a barcode. */
  productsNoSku: number
}

export type AgentCheck = {
  id: AgentCheckId
  pass: boolean
  /** Names of what failed (bots blocked, user agents disallowed) or a count, for the line. */
  names?: string[]
  count?: number
}

export type AgentReadinessReport = {
  origin: string
  checks: AgentCheck[]
  passed: number
  checkedAt: string
}

// ── robots.txt (RFC 9309, the parts agents use) ─────────────────────────────

type RobotsGroup = { agents: string[]; rules: { allow: boolean; path: string }[] }

function robotsGroups(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = []
  let current: RobotsGroup | null = null
  let readingAgents = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (key === 'user-agent') {
      if (!current || !readingAgents) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      readingAgents = true
    } else if ((key === 'allow' || key === 'disallow') && current) {
      readingAgents = false
      if (value) current.rules.push({ allow: key === 'allow', path: value })
    } else {
      readingAgents = false
    }
  }
  return groups
}

const ruleMatches = (pattern: string, path: string) => {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path)
}

/** May `agent` fetch `path`? The most specific group naming it, else `*`; longest rule wins. */
export function robotsAllows(text: string, agent: string, path: string): boolean {
  const groups = robotsGroups(text)
  const name = agent.toLowerCase()
  const own = groups.filter((g) => g.agents.some((a) => a !== '*' && name.includes(a)))
  const rules = (own.length ? own : groups.filter((g) => g.agents.includes('*'))).flatMap(
    (g) => g.rules,
  )
  let best: { allow: boolean; length: number } | null = null
  for (const r of rules) {
    if (!ruleMatches(r.path, path)) continue
    if (!best || r.path.length > best.length || (r.path.length === best.length && r.allow)) {
      best = { allow: r.allow, length: r.path.length }
    }
  }
  return best?.allow ?? true
}

// ── Product page ────────────────────────────────────────────────────────────

type LdNode = Record<string, unknown>

/** Every JSON-LD node on the page, `@graph` members included; broken blocks are skipped. */
export function jsonLdNodes(html: string): LdNode[] {
  const nodes: LdNode[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    try {
      const data = JSON.parse(m[1] ?? '') as unknown
      for (const item of Array.isArray(data) ? data : [data]) {
        if (!item || typeof item !== 'object') continue
        const graph = (item as { '@graph'?: unknown })['@graph']
        if (Array.isArray(graph)) nodes.push(...(graph as LdNode[]))
        else nodes.push(item as LdNode)
      }
    } catch {
      // A theme's broken block says nothing; the others still count.
    }
  }
  return nodes
}

const typeOf = (n: LdNode) => {
  const t = n['@type']
  return Array.isArray(t) ? t.map(String) : [String(t ?? '')]
}

const hasPrice = (offers: unknown): boolean => {
  if (!offers || typeof offers !== 'object') return false
  if (Array.isArray(offers)) return offers.some(hasPrice)
  const o = offers as LdNode
  return o.price != null || o.lowPrice != null || hasPrice(o.offers)
}

/** A `<meta property|name="…">` tag; `name` is a plain tag name like `og:price:amount`. */
const metaTag = (html: string, name: string) =>
  new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i').test(html)

const ok = (f: Fetched | null | undefined) => !!f && f.status === 200

// ── Report ──────────────────────────────────────────────────────────────────

/** Every check in `AGENT_CHECK_IDS` order, pass or fail. */
export function agentReadiness(
  probe: AgentProbe,
  facts: AgentFacts,
  now: Date,
): AgentReadinessReport {
  const html = probe.product?.body ?? ''
  const productPath = probe.product ? new URL(probe.product.url).pathname : '/products/'
  const nodes = jsonLdNodes(html)
  const products = nodes.filter((n) =>
    typeOf(n).some((t) => t === 'Product' || t === 'ProductGroup'),
  )
  const blocked = probe.bots.filter((b) => b.status !== 200).map((b) => b.name)
  const robotsText = ok(probe.robots) ? (probe.robots.body ?? '') : ''
  const disallowed = facts.aiAllowed
    ? ROBOTS_AGENTS.filter(
        (a) => !robotsAllows(robotsText, a, '/') || !robotsAllows(robotsText, a, productPath),
      )
    : [...ROBOTS_AGENTS]
  const sitemapProducts = (probe.sitemap.body ?? '').match(/<loc>[^<]*\/products\/[^<]+<\/loc>/g)
  const group = products.find((n) => typeOf(n).includes('ProductGroup'))
  const single = products.find((n) => typeOf(n).includes('Product'))
  const singleOffer =
    !!single &&
    !!single.offers &&
    !Array.isArray(single.offers) &&
    (single.offers as LdNode)['@type'] !== 'AggregateOffer'
  const checks: AgentCheck[] = [
    { id: 'bots_allowed', pass: probe.bots.length > 0 && blocked.length === 0, names: blocked },
    {
      id: 'robots_allows_ai',
      pass: ok(probe.robots) && disallowed.length === 0,
      names: disallowed,
    },
    { id: 'llms_txt', pass: ok(probe.llms) && !!probe.llms.body?.trim() },
    {
      id: 'sitemap_products',
      pass: ok(probe.sitemap) && (sitemapProducts?.length ?? 0) > 0,
      count: sitemapProducts?.length ?? 0,
    },
    { id: 'product_data', pass: products.some((n) => hasPrice(n.offers) || !!n.hasVariant) },
    {
      id: 'product_variants',
      pass: (!!group && Array.isArray(group.hasVariant)) || (!group && singleOffer),
    },
    {
      id: 'price_tags',
      pass: metaTag(html, 'product:price:amount') || metaTag(html, 'og:price:amount'),
    },
    {
      id: 'markdown_copy',
      pass:
        /<link[^>]+type=["']text\/markdown["'][^>]*>/i.test(html) &&
        ok(probe.markdown) &&
        (probe.markdown?.contentType ?? '').includes('markdown'),
    },
    { id: 'product_feed', pass: ok(probe.feed) && (probe.feed.contentType ?? '').includes('json') },
    { id: 'mcp_endpoint', pass: !!probe.mcpTools?.includes('search_catalog') },
    { id: 'products_have_sku', pass: facts.productsNoSku === 0, count: facts.productsNoSku },
  ]
  return {
    origin: probe.origin,
    checks,
    passed: checks.filter((c) => c.pass).length,
    checkedAt: now.toISOString(),
  }
}
