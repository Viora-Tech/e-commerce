import type { SeoHealthCheckId } from '@commerce/core/seo-health'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Settings → Store health › SEO: what search engines see of the store's products, collections and pages. */
export const seoHealthContent = {
  title: 'SEO',
  intro:
    'What Google and Bing show for your products, collections and pages. We check everything shoppers can see.',
  checkedItems: (products: number, collections: number, pages: number) =>
    `${plural(products, 'product', 'products')}, ${plural(collections, 'collection', 'collections')} and ${plural(pages, 'page', 'pages')} checked`,
  passed: (n: number, total: number) => `${n} of ${total} pass`,
  loading: 'Checking your listings…',
  failed: 'Could not check your listings. Try again in a moment.',
  recheck: 'Check again',
  pass: 'Pass',
  fail: 'Fix',
  more: (n: number) => `and ${n} more`,
  report: 'Open SEO report',
  resource: { product: 'Product', collection: 'Collection', page: 'Page' },
  checks: {
    description_missing: {
      title: 'Every listing has a search description',
      fix: (n: number) =>
        `${plural(n, 'item has', 'items have')} no search description and no description text, so Google makes one up. Write one, or use Fix with AI on the SEO report.`,
    },
    title_short: {
      title: 'Titles say enough',
      fix: (n: number) =>
        `${plural(n, 'item has', 'items have')} a title under 15 characters. Add what it is and who it is for.`,
    },
    title_duplicate: {
      title: 'Every title is different',
      fix: (n: number) =>
        `${plural(n, 'item shares', 'items share')} a title with another, so search engines cannot tell them apart.`,
    },
    alt_missing: {
      title: 'Product photos have alt text',
      fix: (n: number, images: number) =>
        `${plural(images, 'photo', 'photos')} on ${plural(n, 'product', 'products')} have no alt text. Image search and screen readers need it.`,
    },
    handle_copy: {
      title: 'No web addresses ending in “-copy”',
      fix: (n: number) =>
        `${plural(n, 'product was', 'products were')} duplicated and kept “-copy” in the web address. Change the handle under Search engine listing.`,
    },
  } satisfies Record<SeoHealthCheckId, { title: string; fix: (...args: never[]) => string }>,
}
