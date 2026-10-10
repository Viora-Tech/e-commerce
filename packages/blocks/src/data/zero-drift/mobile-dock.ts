/**
 * Copy, defaults and field labels for the mobile dock (Zero Drift theme `sections/mobile-dock.liquid`).
 * Default links are the theme's live `sections/footer-group.json` values.
 */
export const mobileDockContent = {
  label: 'Mobile dock',
  nav: 'Quick links',
  cart: 'Cart',
  cartCount: (count: number) => `${count} ${count === 1 ? 'item' : 'items'} in cart`,
  links: [
    { icon: 'search', label: 'Search', url: '/search' },
    { icon: 'cart', label: 'Shop', url: '/collections/all' },
    { icon: 'heart', label: 'Wishlist', url: '/pages/wishlist' },
    { icon: 'user', label: 'Account', url: '/account' },
  ],
  newLink: { icon: 'search', label: 'Search', url: '/search' },
  /** The theme's `max_blocks`; the cart is always added after them. */
  maxLinks: 4,
  fields: {
    links: 'Links (the cart is always last)',
    icon: 'Icon',
    label: 'Label',
    url: 'Link',
    fallback: 'Link',
  },
  icons: [
    { label: 'Search', value: 'search' },
    { label: 'Account', value: 'user' },
    { label: 'Heart', value: 'heart' },
    { label: 'Bag', value: 'cart' },
    { label: 'Star', value: 'star' },
    { label: 'Box', value: 'stock' },
    { label: 'Guaranteed', value: 'guaranteed' },
    { label: 'Shipping', value: 'shipping' },
    { label: 'Delivery', value: 'delivery' },
    { label: 'Location', value: 'location' },
    { label: 'Edit', value: 'edit' },
    { label: 'Payment', value: 'payment' },
  ],
} as const
