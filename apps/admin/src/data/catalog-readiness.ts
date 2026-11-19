/** Copy for Catalog readiness' "By problem" summary: issues grouped by what is wrong. */
export const catalogReadinessContent = {
  heading: 'By problem',
  groups: {
    no_description: 'No description',
    short_description: 'Description too short',
    no_identifier: 'No GTIN or brand',
    no_images: 'No images',
    few_images: 'Fewer than 3 images',
    no_category: 'No product category',
    no_refund_policy: 'No return policy',
    no_shipping_policy: 'No delivery estimate',
    no_terms: 'No terms of service',
  },
  products: (n: number) => (n === 1 ? '1 product' : `${n} products`),
  fixAll: (n: number) => `Fix ${n} with AI`,
  show: 'Show',
  showing: (label: string) => `Showing: ${label}`,
  clear: 'Show all',
} as const
