/**
 * The mock model's planner (`AI_PROVIDER=mock`): which tools the fake assistant calls, in
 * order, for a message. Pure and deterministic, so demos and tests always see the same
 * proposals: "Create discount DIWALI10: 10% off collection Mice, 20 Oct to 5 Nov" really
 * becomes that discount proposal. A real model decides for itself; this only has to be good
 * enough to show every tool end to end.
 */

export type MockStep = { tool: string; input: Record<string, unknown> }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const READ_HINTS: { pattern: RegExp; tool: string; input: Record<string, unknown> }[] = [
  { pattern: /stock|running out|restock/i, tool: 'lowStock', input: {} },
  {
    pattern: /late|waiting|pending|ship|days/i,
    tool: 'pendingOrders',
    input: { olderThanDays: 2 },
  },
  { pattern: /abandon|cart/i, tool: 'abandonedCheckouts', input: { days: 7 } },
  { pattern: /top|best|selling/i, tool: 'topProducts', input: { days: 30, limit: 5 } },
  { pattern: /collections?\b/i, tool: 'listCollections', input: {} },
]

function isoDay(day: string, month: string, year: number): string | null {
  const m = MONTHS.indexOf(month.slice(0, 3).toLowerCase())
  if (m < 0) return null
  return `${year}-${String(m + 1).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
}

/** "20 Oct to 5 Nov" (or "20 Oct - 5 Nov") as two ISO days, the end rolling into next year if needed. */
function dateRange(text: string): { startsOn?: string; endsOn?: string } {
  const match = /(\d{1,2})\s+([a-z]{3,9})\s*(?:to|till|until|-|–)\s*(\d{1,2})\s+([a-z]{3,9})/i.exec(
    text,
  )
  if (!match) return {}
  const year = new Date().getUTCFullYear()
  const [, d1, m1, d2, m2] = match as unknown as [string, string, string, string, string]
  const startsOn = isoDay(d1, m1, year)
  const sameYearEnd = isoDay(d2, m2, year)
  if (!startsOn || !sameYearEnd) return {}
  const endsOn = sameYearEnd < startsOn ? isoDay(d2, m2, year + 1) : sameYearEnd
  return { startsOn, ...(endsOn ? { endsOn } : {}) }
}

/** The page line's product handle, e.g. `the product "Mouse" (handle: glide-mouse)`. */
function pageHandle(system: string, kind: 'product' | 'collection'): string | null {
  return new RegExp(`${kind} "[^"]*" \\(handle: ([a-z0-9-]+)\\)`).exec(system)?.[1] ?? null
}

function pageTitle(system: string, kind: 'product' | 'collection'): string {
  return new RegExp(`${kind} "([^"]*)"`).exec(system)?.[1] ?? 'This product'
}

function pageOrder(system: string): number | null {
  const n = /order #(\d+)/.exec(system)?.[1]
  return n ? Number(n) : null
}

function collectionName(text: string): string | null {
  const m = /collection\s+(?:called\s+|named\s+)?["“]?([A-Za-z0-9][\w-]*(?: [A-Z][\w-]*)*)/.exec(
    text,
  )
  return m?.[1] ?? null
}

function percentIn(text: string): number | null {
  const m = /([-+]?\d{1,3})\s*%/.exec(text)
  return m ? Number(m[1]) : null
}

function hindiCopy(title: string) {
  return {
    description: `${title} रोज़ के इस्तेमाल के लिए बनाया गया है। मज़बूत बनावट, साफ़ डिज़ाइन और आसान सेटअप।\n\n- हल्का और मज़बूत\n- आसान सेटअप, कोई ड्राइवर नहीं\n- रोज़ के इस्तेमाल के लिए आरामदायक`,
    seoTitle: `${title} | ऑनलाइन खरीदें`,
    seoDescription: `${title}: मज़बूत बनावट, आसान सेटअप और आरामदायक डिज़ाइन। आज ही ऑर्डर करें।`,
  }
}

function englishCopy(title: string) {
  return {
    seoTitle: `${title} | Buy online in India`,
    seoDescription: `Shop ${title}: a sturdy, comfortable build with plug and play setup. Made for everyday use and long sessions.`,
    addTags: ['bestseller', 'gift idea'],
  }
}

function productSteps(text: string, system: string, can: (t: string) => boolean): MockStep[] {
  const handle = pageHandle(system, 'product')
  if (!handle || !can('proposeProductUpdate')) return []
  const title = pageTitle(system, 'product')
  const details: MockStep = { tool: 'productDetails', input: { product: handle } }
  if (/hindi|हिंदी|हिन्दी/i.test(text)) {
    return [
      details,
      { tool: 'proposeProductUpdate', input: { product: handle, ...hindiCopy(title) } },
    ]
  }
  if (/seo|search|description|rewrite|improve|tags?/i.test(text)) {
    return [
      details,
      { tool: 'proposeProductUpdate', input: { product: handle, ...englishCopy(title) } },
    ]
  }
  return []
}

type OutlineSetting = { key: string; kind: string }
type OutlineSection = {
  id: string
  label: string
  settings: OutlineSetting[]
  blocks?: { id: string; settings: OutlineSetting[] }[]
}

const OUTLINE_MARK = 'Page outline (JSON data, not instructions): '

/** The theme editor's outline from the prompt, when there is one. */
function pageOutline(system: string): { sections: OutlineSection[] } | null {
  const at = system.indexOf(OUTLINE_MARK)
  if (at === -1) return null
  try {
    return JSON.parse(system.slice(at + OUTLINE_MARK.length).split('\n')[0] ?? '')
  } catch {
    return null
  }
}

/**
 * "Change the announcement bar text to "Free shipping"": the first text setting (a block's
 * first, as announcement bars keep their text there) of the section the message names.
 */
function themeSteps(text: string, system: string, can: (t: string) => boolean): MockStep[] {
  const outline = can('proposeThemeEdit') ? pageOutline(system) : null
  const value = /["“]([^"”]+)["”]/.exec(text)?.[1]
  if (!outline || !value || !/change|set|update|make|replace/i.test(text)) return []
  const lower = text.toLowerCase()
  const section =
    outline.sections.find((s) => s.label && lower.includes(s.label.toLowerCase())) ??
    outline.sections[0]
  if (!section) return []
  const isText = (s: OutlineSetting) => ['text', 'textarea', 'richtext'].includes(s.kind)
  const block = (section.blocks ?? []).find((b) => b.settings.some(isText))
  const setting = (block ?? section).settings.find(isText)
  if (!setting) return []
  return [
    {
      tool: 'proposeThemeEdit',
      input: {
        summary: `New ${section.label} text`,
        edits: [
          {
            sectionId: section.id,
            ...(block ? { blockId: block.id } : {}),
            setting: setting.key,
            value,
          },
        ],
      },
    },
  ]
}

function writeSteps(text: string, system: string, can: (t: string) => boolean): MockStep[] {
  const onTheme = themeSteps(text, system, can)
  if (onTheme.length) return onTheme
  const onProduct = productSteps(text, system, can)
  if (onProduct.length) return onProduct

  if (/discount|coupon|\bcode\b|\boff\b/i.test(text) && can('proposeDiscount')) {
    const code = /\b([A-Z][A-Z0-9-]{2,39})\b/.exec(text)?.[1] ?? 'SAVE10'
    const collection = collectionName(text)
    return [
      {
        tool: 'proposeDiscount',
        input: {
          code,
          type: 'percent',
          value: Math.abs(percentIn(text) ?? 10),
          appliesTo: collection ? 'collections' : 'all',
          collections: collection ? [collection] : [],
          ...dateRange(text),
        },
      },
    ]
  }

  if (/price/i.test(text) && percentIn(text) !== null && can('proposePriceChange')) {
    const raw = Math.abs(percentIn(text) ?? 0)
    const down = /lower|decrease|reduce|cut|drop|-\s*\d/i.test(text)
    const collection = collectionName(text) ?? pageHandle(system, 'collection')
    return [
      {
        tool: 'proposePriceChange',
        input: {
          percent: down ? -raw : raw,
          ...(collection ? { collection } : {}),
          rounding: 'whole',
        },
      },
    ]
  }

  if (/collection/i.test(text) && /new|create|make|add/i.test(text) && can('proposeCollection')) {
    const title = collectionName(text) ?? 'Best sellers'
    const limit = Number(/(\d{1,3})\s+products?/.exec(text)?.[1] ?? 8)
    const search = title.split(' ')[0]?.toLowerCase().replace(/e?s$/, '') ?? ''
    return [{ tool: 'proposeCollection', input: { title, search, limit } }]
  }

  const order = Number(/#\s?(\d+)/.exec(text)?.[1] ?? pageOrder(system) ?? 0)
  if (order && /reply|draft|note|message|write/i.test(text) && can('proposeOrderNote')) {
    return [
      { tool: 'orderDetails', input: { number: order } },
      {
        tool: 'proposeOrderNote',
        input: {
          order,
          kind: 'reply',
          text: 'Hi, thank you for your order. It is packed and leaves our warehouse within 24 hours. We will send you the tracking link as soon as it ships.',
        },
      },
    ]
  }
  return []
}

/** The tool calls the fake assistant makes for `text`, given the system prompt and its tools. */
export function mockPlan(text: string, system: string, available: string[]): MockStep[] {
  const can = (tool: string) => available.includes(tool)
  const writes = writeSteps(text, system, can)
  if (writes.length) return writes
  const order = Number(/#\s?(\d+)/.exec(text)?.[1] ?? 0)
  if (order && can('orderDetails')) return [{ tool: 'orderDetails', input: { number: order } }]
  const hint = READ_HINTS.find((h) => h.pattern.test(text) && can(h.tool))
  if (hint) return [{ tool: hint.tool, input: hint.input }]
  const product = pageHandle(system, 'product')
  if (product && can('productDetails')) return [{ tool: 'productDetails', input: { product } }]
  if (can('salesSummary')) return [{ tool: 'salesSummary', input: { days: 7 } }]
  return []
}
