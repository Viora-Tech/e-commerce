/** Copy for Online store › SEO: the store's SEO score and the issues to fix. */
export const seoReportContent = {
  title: 'SEO',
  subtitle:
    'How well Google, Bing and AI search (ChatGPT, Perplexity) can find and show your products, collections and pages.',
  unavailable: {
    heading: 'SEO report unavailable',
    body: 'You need access to the online store to see its SEO report.',
  },
  score: {
    label: 'SEO score',
    outOf: 'out of 100',
    good: 'Looking good',
    fair: 'A few things to fix',
    poor: 'Needs work',
    checked: (products: number, collections: number, pages: number) =>
      `Checked ${products} live products, ${collections} collections and ${pages} published pages.`,
    counts: (high: number, medium: number, low: number) =>
      `${high} high impact · ${medium} medium · ${low} low`,
    high: (n: number) => `${n} high impact`,
    medium: (n: number) => `${n} medium`,
    low: (n: number) => `${n} low`,
    issues: (n: number) => (n === 1 ? 'issue' : 'issues'),
    resources: { product: 'Products', collection: 'Collections', page: 'Pages', menu: 'Menus' },
  },
  fix: {
    heading: 'Fix with AI',
    body: 'Write what is missing for you. Nothing is saved until you review the changes and press Apply.',
    seo: (n: number) => `Write search titles and descriptions (${n})`,
    altText: (n: number) => `Write photo alt text (${n})`,
    description: (n: number) => `Write fuller product descriptions (${n})`,
    keywords: (n: number) => `Suggest search keywords (${n})`,
    capped: (max: number) => `Up to ${max} products per run. Run it again for the rest.`,
    off: 'Turn on Write with AI in Settings → AI to fix these automatically.',
    nothing: 'Nothing for AI to write right now.',
  },
  issues: {
    heading: 'Issues to fix',
    body: 'Most important first. Open an item to fix it by hand.',
    empty: 'Nothing to fix. Everything checked looks good.',
    filters: { all: 'All', high: 'High impact', medium: 'Medium', low: 'Low' },
    severity: { high: 'High', medium: 'Medium', low: 'Low' },
    resource: { product: 'Product', collection: 'Collection', page: 'Page', menu: 'Menu' },
    edit: 'Edit',
    more: (n: number) => `Show ${n} more`,
  },
  kinds: {
    title_missing: () => 'No search title.',
    title_long: (d: string | null) => `Search title is ${d} characters; Google shows about 60.`,
    title_short: (d: string | null) => `Search title is only ${d} characters; say more about it.`,
    title_duplicate: (d: string | null) => `Same search title as “${d}”.`,
    description_missing: () => 'No search description and no text to borrow one from.',
    description_long: (d: string | null) =>
      `Search description is ${d} characters; Google shows about 160.`,
    description_short: (d: string | null) =>
      `Search description is only ${d} characters; aim for 70 to 160.`,
    description_duplicate: (d: string | null) => `Same search description as “${d}”.`,
    image_missing: () =>
      'No photos. Products without photos rarely show in image or shopping results.',
    alt_missing: (d: string | null) => `${d} photo(s) without alt text.`,
    content_thin: (d: string | null) =>
      `Description has ${d} words; 50 or more helps search and AI answers.`,
    shopping_brand_missing: () => 'No brand (vendor) for Google Shopping.',
    shopping_gtin_missing: () => 'No barcode (GTIN) on any variant for Google Shopping.',
    handle_bad: (d: string | null) =>
      `Web address “${d}” should be short, lowercase words joined by hyphens.`,
    link_broken: (d: string | null) =>
      `Link to ${d} goes nowhere: that page no longer exists. Fix the link or add a redirect.`,
    link_old_store: (d: string | null) =>
      `Link still points at your old Shopify store (${d}); it breaks when that store closes.`,
    collection_empty: () =>
      'No live products in this collection; shoppers and Google find an empty page.',
    collection_image_missing: () => 'No collection image for search results and social shares.',
    category_missing: () => 'No product category; Google Shopping uses it to place the product.',
    page_thin: (d: string | null) =>
      `Page has ${d} words; a little more helps search and AI answers.`,
    keyword_missing: () =>
      'No search keywords chosen. Write with AI writes better search text around them.',
    low_ctr: (d: string | null) =>
      `Shown ${d} times on Google, few clicks: improve its search title and description.`,
    almost_page_one: (d: string | null) =>
      `At position ${d} on Google, just off page 1: a sharper search title and description and a little more text can move it up.`,
  },
}
