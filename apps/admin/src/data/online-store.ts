/** Copy for the Online Store sales channel. */
export const onlineStoreContent = {
  themes: {
    heading: 'One theme, live',
    body: 'Your storefront runs the Glide theme. Colours, fonts and dark mode will be editable here.',
    action: { label: 'Edit pages', href: '/online-store/pages' },
  },
  blog: {
    heading: 'No blog posts',
    body: 'Posts publish to your storefront blog and help search engines find you for the topics your shoppers care about.',
    action: { label: 'Edit pages', href: '/online-store/pages' },
  },
  navigation: {
    heading: 'Navigation',
    body: 'Menus for the storefront header and footer. Today they come from the theme; soon you will edit them here.',
    action: { label: 'Edit pages', href: '/online-store/pages' },
  },
  preferences: {
    heading: 'Preferences',
    body: 'Storefront title, meta description, social sharing image and password protection.',
    action: { label: 'Store settings', href: '/settings/general' },
  },
} as const
