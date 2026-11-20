/**
 * One product as Markdown for AI agents (`/products/<handle>.md`, linked from the product page's
 * `<link rel="alternate" type="text/markdown">`): name, price, stock per variant, options and the
 * description as plain text, with the store's shipping and refund policy links. The same data as
 * `/products/<handle>.json`, so it always matches the page. Pure.
 */

import { numericId } from '@commerce/core/theme-import'
import { htmlToPlainText } from '@commerce/core/marketing'
import { seoContent } from '@/data/seo'
import { type FeedProduct, rupees } from './shape'

const copy = seoContent.markdown

/** A value that cannot break a Markdown table row or heading. */
const cell = (text: string) => text.replace(/\|/g, '/').replace(/\s+/g, ' ').trim()

const money = (paise: number, currency: string) =>
  currency === 'INR' ? `₹${rupees(paise)}` : `${rupees(paise)} ${currency}`

type Variant = FeedProduct['variants'][number]

const stock = (v: Variant) =>
  v.available
    ? v.preorder && v.inventoryQuantity <= 0
      ? copy.preorder
      : copy.inStock
    : copy.soldOut

export function productMarkdown(p: FeedProduct, origin: string, currency = 'INR'): string {
  const url = `${origin}/products/${p.handle}`
  const prices = p.variants.map((v) => v.price)
  const low = prices.length ? Math.min(...prices) : null
  const high = prices.length ? Math.max(...prices) : null
  const price =
    low === null || high === null
      ? null
      : low === high
        ? money(low, currency)
        : copy.priceRange(money(low, currency), money(high, currency))
  const one = p.variants.length === 1 ? p.variants[0] : undefined
  const mrp = one?.compareAtPrice && one.compareAtPrice > one.price ? one.compareAtPrice : null
  const facts = [
    p.vendor ? `- ${copy.brand}: ${cell(p.vendor)}` : null,
    p.type ? `- ${copy.type}: ${cell(p.type)}` : null,
    price ? `- ${copy.price}: ${price}` : null,
    mrp ? `- ${copy.mrp}: ${money(mrp, currency)}` : null,
    `- ${copy.availability}: ${p.variants.some((v) => v.available) ? copy.inStock : copy.soldOut}`,
    ...p.options
      .filter((o) => o.values.length > 1)
      .map((o) => `- ${cell(o.name)}: ${o.values.map(cell).join(', ')}`),
  ].filter((line): line is string => line !== null)
  const variants =
    p.variants.length > 1
      ? [
          `## ${copy.variants}`,
          '',
          `| ${copy.variant} | ${copy.price} | ${copy.availability} | ${copy.sku} | ${copy.buy} |`,
          '| --- | --- | --- | --- | --- |',
          ...p.variants.map(
            (v) =>
              `| ${cell(v.title)} | ${money(v.price, currency)} | ${stock(v)} | ${cell(v.sku ?? '')} | ${url}?variant=${numericId(v.id)} |`,
          ),
          '',
        ]
      : []
  const description = htmlToPlainText(p.descriptionHtml ?? '').trim()
  return [
    `# ${cell(p.title)}`,
    '',
    url,
    '',
    ...facts,
    '',
    ...variants,
    ...(description ? [`## ${copy.description}`, '', description, ''] : []),
    `## ${copy.policies}`,
    '',
    `- [${copy.shipping}](${origin}/policies/shipping-policy)`,
    `- [${copy.refund}](${origin}/policies/refund-policy)`,
    '',
  ].join('\n')
}
