import { headers } from 'next/headers'
import { SEO_DESCRIPTION_MAX, seoContent } from '@/data/seo'
import { originFromHost } from './store-resolver'

/** The shopper-facing origin of this request, for canonical and JSON-LD URLs. */
export async function requestOrigin(): Promise<string> {
  const h = await headers()
  // The Host the proxy routed on (never x-forwarded-host, which the client controls).
  const host = h.get('host') ?? 'localhost'
  const dev = host.startsWith('localhost') || host.includes('.localhost')
  return originFromHost(host, h.get('x-forwarded-proto'), dev)?.origin ?? 'http://localhost'
}

/**
 * JSON-LD as a script body. `<` becomes the six characters `<`, which JSON parsers
 * read back as `<` but an HTML parser never sees as a tag, so no value can close the script.
 */
export function jsonLd(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') }
}

export function breadcrumbList(origin: string, items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  }
}

/** A meta description from free text: one line, cut on a word near the limit. */
export function metaDescription(text: string | null | undefined): string | undefined {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!flat) return undefined
  if (flat.length <= SEO_DESCRIPTION_MAX) return flat
  const cut = flat.slice(0, SEO_DESCRIPTION_MAX - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > SEO_DESCRIPTION_MAX * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** Paise as the decimal string schema.org prices use ("1499.00"). */
export function paiseToAmount(paise: number): string {
  return (paise / 100).toFixed(2)
}

type StoreIdentity = {
  name: string
  origin: string
  logoUrl?: string | null | undefined
  description?: string | undefined
  email?: string | null | undefined
  phone?: string | null | undefined
}

/** Organization + WebSite with a sitelinks search box, for the home page. */
export function storeGraph(s: StoreIdentity) {
  const org = `${s.origin}/#organization`
  const contact =
    s.email || s.phone
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: seoContent.customerService,
            ...(s.email ? { email: s.email } : {}),
            ...(s.phone ? { telephone: s.phone } : {}),
          },
        }
      : {}
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': org,
        name: s.name,
        url: `${s.origin}/`,
        ...(s.logoUrl ? { logo: s.logoUrl } : {}),
        ...contact,
      },
      {
        '@type': 'WebSite',
        '@id': `${s.origin}/#website`,
        name: s.name,
        url: `${s.origin}/`,
        ...(s.description ? { description: s.description } : {}),
        publisher: { '@id': org },
        inLanguage: 'en-IN',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${s.origin}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

type ProductForLd = {
  handle: string
  title: string
  description: string | undefined
  vendor: string | null
  images: { url: string }[]
  variants: {
    id: string
    title: string
    sku: string | null
    pricePaise: number
    available: number
    purchasable?: boolean | undefined
  }[]
  preorder?: { enabled: boolean } | null | undefined
  /** Average and count of published reviews (Reviews app); null or absent with none. */
  rating?: { value: number; count: number } | null | undefined
  /** A few published reviews, for `review` (Google reads up to a handful). */
  reviews?: { author: string; rating: number; title: string; body: string }[] | undefined
}

/**
 * Product with one Offer per variant (INR, stock), its rating and a few reviews when the
 * Reviews app has published ones, and its breadcrumb trail.
 */
export function productGraph(p: ProductForLd, origin: string, currency: string, storeName: string) {
  const url = `${origin}/products/${p.handle}`
  const offers = p.variants.map((v) => ({
    '@type': 'Offer',
    url,
    ...(p.variants.length > 1 ? { name: v.title } : {}),
    ...(v.sku ? { sku: v.sku } : {}),
    price: paiseToAmount(v.pricePaise),
    priceCurrency: currency,
    availability:
      v.available > 0
        ? 'https://schema.org/InStock'
        : p.preorder?.enabled && v.purchasable
          ? 'https://schema.org/PreOrder'
          : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': `${origin}/#organization` },
  }))
  const prices = p.variants.map((v) => v.pricePaise)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: p.title,
        url,
        ...(p.description ? { description: p.description } : {}),
        ...(p.images.length ? { image: p.images.map((i) => i.url) } : {}),
        brand: { '@type': 'Brand', name: p.vendor || storeName },
        ...(p.variants.length === 1 && p.variants[0]?.sku ? { sku: p.variants[0].sku } : {}),
        offers:
          offers.length > 1
            ? {
                '@type': 'AggregateOffer',
                priceCurrency: currency,
                lowPrice: paiseToAmount(Math.min(...prices)),
                highPrice: paiseToAmount(Math.max(...prices)),
                offerCount: offers.length,
                offers,
              }
            : offers[0],
        ...(p.rating && p.rating.count > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: p.rating.value,
                reviewCount: p.rating.count,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
        ...(p.reviews?.length
          ? {
              review: p.reviews.map((r) => ({
                '@type': 'Review',
                author: { '@type': 'Person', name: r.author },
                reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
                ...(r.title ? { name: r.title } : {}),
                reviewBody: r.body,
              })),
            }
          : {}),
      },
      breadcrumbList(origin, [
        { name: seoContent.home, path: '/' },
        { name: p.title, path: `/products/${p.handle}` },
      ]),
    ],
  }
}

/** CollectionPage listing this page of products, and its breadcrumb trail. */
export function collectionGraph(
  c: { handle: string; title: string; description: string | undefined },
  items: { handle: string; title: string }[],
  firstPosition: number,
  total: number,
  origin: string,
) {
  const url = `${origin}/collections/${c.handle}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url,
        name: c.title,
        url,
        ...(c.description ? { description: c.description } : {}),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: total,
          itemListElement: items.map((p, i) => ({
            '@type': 'ListItem',
            position: firstPosition + i,
            url: `${origin}/products/${p.handle}`,
            name: p.title,
          })),
        },
      },
      breadcrumbList(origin, [
        { name: seoContent.home, path: '/' },
        { name: seoContent.collections, path: '/collections' },
        { name: c.title, path: `/collections/${c.handle}` },
      ]),
    ],
  }
}

/** Every indexable URL is a path on this host; the store never canonicalises elsewhere. */
export function canonicalPath(path: string, page = 1): string {
  return page > 1 ? `${path}?page=${page}` : path
}

/** Robots directive for pages that must never be indexed (cart, checkout, account). */
export const NO_INDEX = { index: false, follow: false } as const
