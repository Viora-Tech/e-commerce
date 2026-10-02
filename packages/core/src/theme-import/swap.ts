/** SOURCE OF TRUTH: the behaviour swap table — WHAT: each Shopify feature an imported theme reaches for (cart AJAX, checkout, predictive search, accounts, newsletter and contact forms, app blocks, metafields, fonts, hosted images...), how we detect it in the theme's Liquid, and what runs instead / WHY: the owner's rule is "copy the look exactly, run every function on our own features"; the import report, the storefront shim and the docs all read this one table. Browser safe */

export type SwapKey =
  | 'cart_add'
  | 'cart_drawer'
  | 'checkout'
  | 'predictive_search'
  | 'customer_accounts'
  | 'newsletter'
  | 'contact'
  | 'app_blocks'
  | 'metafields'
  | 'fonts'
  | 'hosted_images'
  | 'payment_icons'
  | 'localization'
  | 'recommendations'
  | 'preorder'
  | 'app_data'

export type SwapRow = {
  key: SwapKey
  /** What the theme used on Shopify, in plain words. */
  shopify: string
  /** What runs here instead, in plain words. */
  ours: string
  /** `replaced`: works on our feature. `unavailable`: no equivalent yet; the look stays. */
  kind: 'replaced' | 'unavailable'
  /** Matches Liquid that relies on it. */
  detect: RegExp
}

export const SWAP_TABLE: readonly SwapRow[] = [
  {
    key: 'cart_add',
    shopify: 'Add to cart buttons and /cart/add.js',
    ours: 'Our cart: the item goes into our cart and the shopper lands on the cart page',
    kind: 'replaced',
    detect: /form\s+['"]product['"]|cart_add_url|\/cart\/add/,
  },
  {
    key: 'cart_drawer',
    shopify: 'Cart drawer refreshed through /cart.js and section rendering',
    ours: 'Our cart page (/cart). The drawer keeps its look; its live refresh opens our cart instead',
    kind: 'replaced',
    detect: /cart_change_url|\/cart\/change|\/cart\.js|section_id=|sections=/,
  },
  {
    key: 'checkout',
    shopify: 'Shopify checkout',
    ours: 'Our checkout with your payment methods, COD rules and GST invoices (checkout is not themeable)',
    kind: 'replaced',
    detect: /\/checkout|name=["']checkout["']/,
  },
  {
    key: 'predictive_search',
    shopify: 'Predictive search (/search/suggest)',
    ours: 'Our search page (/search); the search box keeps its look',
    kind: 'replaced',
    detect: /predictive_search|search\/suggest/,
  },
  {
    key: 'customer_accounts',
    shopify: 'Shopify customer accounts (login, register, addresses, orders)',
    ours: 'Our account pages with one-time-code sign in',
    kind: 'replaced',
    detect: /form\s+['"](customer_login|create_customer|customer_address|recover_customer_password|reset_customer_password|activate_customer_password)['"]|routes\.account/,
  },
  {
    key: 'newsletter',
    shopify: 'Newsletter signup (form "customer")',
    ours: 'Our subscriber list with double opt-in (Customers, marketing consent)',
    kind: 'replaced',
    detect: /form\s+['"]customer['"]/,
  },
  {
    key: 'contact',
    shopify: 'Contact form (form "contact")',
    ours: 'Not available yet: the form shows but cannot send. Show your email or WhatsApp number instead',
    kind: 'unavailable',
    detect: /form\s+['"]contact['"]/,
  },
  {
    key: 'app_blocks',
    shopify: 'Shopify app blocks (@app, such as Judge.me or Klaviyo)',
    ours: 'Our apps where one exists (Reviews, Back in stock, EMI); otherwise left out',
    kind: 'unavailable',
    detect: /["']@app["']/,
  },
  {
    key: 'app_data',
    shopify: 'Data from Shopify apps (Judge.me reviews and similar)',
    ours: 'Not available yet: the section stays hidden until our Reviews app collects reviews',
    kind: 'unavailable',
    detect: /metafields\.(judgeme|reviews|yotpo|loox|stamped|okendo|klaviyo)/,
  },
  {
    key: 'metafields',
    shopify: 'Metafields and metaobjects',
    ours: 'Blank until you add matching extra fields or content types here',
    kind: 'unavailable',
    detect: /\.metafields\.(?!judgeme|reviews|yotpo|loox|stamped|okendo|klaviyo)|metaobjects/,
  },
  {
    key: 'fonts',
    shopify: 'Shopify font library (fonts.shopifycdn.com)',
    ours: 'The same font families, loaded from Google Fonts',
    kind: 'replaced',
    detect: /font_face|font_url/,
  },
  {
    key: 'hosted_images',
    shopify: 'Images in Shopify Files (shopify://shop_images)',
    ours: 'Copied into your Files during the import',
    kind: 'replaced',
    detect: /shopify:\/\/shop_images/,
  },
  {
    key: 'payment_icons',
    shopify: 'Payment icons (payment_type_svg_tag)',
    ours: 'Simple labelled payment marks for your enabled methods',
    kind: 'replaced',
    detect: /payment_type_svg_tag/,
  },
  {
    key: 'localization',
    shopify: 'Country and currency selector',
    ours: 'India and rupees only for now; the selector shows one choice',
    kind: 'replaced',
    detect: /form\s+['"](localization|currency)['"]/,
  },
  {
    key: 'recommendations',
    shopify: 'Product recommendations (/recommendations/products)',
    ours: 'Empty for now; our Related products section can take its place',
    kind: 'unavailable',
    detect: /product_recommendations_url|recommendations\/products/,
  },
  {
    key: 'preorder',
    shopify: 'Pre-order apps (selling plans named "Pre-order")',
    ours: 'Our built-in pre-order: products set to pre-order show as pre-order in the theme',
    kind: 'replaced',
    detect: /selling_plan_groups|preorder/,
  },
]

/** Swap rows a piece of Liquid relies on. */
export function swapsIn(source: string): SwapKey[] {
  return SWAP_TABLE.filter((row) => row.detect.test(source)).map((row) => row.key)
}
