import type { ArticleLoader, CardCollection, CardProduct } from '@commerce/blocks/puck'

type CardArticle = Awaited<ReturnType<ArticleLoader>>[number]

/**
 * Stand-in catalogue for the Add panel's section pictures: neutral products, collections and
 * posts, so product sections show cards rather than an empty state. Pictures are inline SVG
 * (soft greys with a product-shaped block), never real merchant data.
 */

const TONES = [
  ['#E9EBEF', '#C9CED6'],
  ['#EEF0F2', '#D5D9DF'],
  ['#E4E7EC', '#BCC3CD'],
  ['#F1F2F4', '#D9DCE1'],
] as const

function picture(i: number): string {
  const [top, bottom] = TONES[i % TONES.length] ?? TONES[0]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><rect x="170" y="290" width="460" height="220" rx="28" fill="#FFFFFF" fill-opacity="0.55"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const NAMES = [
  'Everyday tote',
  'Linen shirt',
  'Ceramic mug',
  'Desk lamp',
  'Wool scarf',
  'Leather wallet',
  'Water bottle',
  'Canvas sneakers',
]

export const DEMO_PRODUCTS: CardProduct[] = NAMES.map((title, i) => ({
  id: `demo-${i}`,
  handle: `demo-${i}`,
  title,
  vendor: 'Your brand',
  productType: null,
  pricePaise: (1299 + i * 400) * 100,
  mrpPaise: i % 3 === 0 ? (1799 + i * 400) * 100 : null,
  available: 10,
  images: [{ url: picture(i), alt: title }],
}))

export const DEMO_COLLECTIONS: CardCollection[] = ['New in', 'Bestsellers', 'Gifts', 'Sale'].map(
  (title, i) => ({
    handle: `demo-collection-${i}`,
    title,
    imageUrl: picture(i + 1),
    productCount: 12 + i * 3,
  }),
)

export const DEMO_ARTICLES: CardArticle[] = [
  'How we make it',
  'A guide to care',
  'Behind the studio',
].map((title, i) => ({
  id: `demo-article-${i}`,
  href: '#',
  title,
  excerpt: 'A short look at what goes into every piece we make.',
  author: 'Your brand',
  publishedAt: '2026-01-01T00:00:00.000Z',
  dateLabel: '1 Jan 2026',
  imageUrl: picture(i + 2),
  imageAlt: title,
  blogTitle: 'Journal',
}))
