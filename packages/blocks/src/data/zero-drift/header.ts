/**
 * Copy, defaults and field labels for the Header section (Zero Drift theme `sections/header.liquid`).
 * Defaults are the theme's live `sections/header-group.json` values.
 */
export const headerContent = {
  label: 'Header',
  defaults: {
    menu: '',
    logoPosition: 'center',
    sticky: 'always',
    showWishlist: true,
    showMenuImages: true,
    menuHover: 'underline',
    popularTerms: 'new arrivals, best sellers, sale, gift cards',
    featureCards: [
      {
        menuItem: 'Explore',
        collection: '',
        image: { url: '', alt: '' },
        eyebrow: 'Not sure what to buy?',
        label: 'Take the 2-minute quiz',
        link: '/pages/find-your-match',
        style: 'dark',
      },
    ],
  },
  newFeatureCard: {
    menuItem: '',
    collection: '',
    image: { url: '', alt: '' },
    eyebrow: '',
    label: 'Shop the collection',
    link: '',
    style: 'light',
  },
  /** The theme caps a menu's curated cards, and its brand pills, at these. */
  maxCardsPerMenu: 3,
  maxBrands: 10,
  /** A menu item whose title contains this lends its links to the "Shop by brand" pills. */
  brandMenuWord: 'brand',
  account: 'Account',
  wishlist: 'Wishlist',
  wishlistHref: '/pages/wishlist',
  fields: {
    menu: 'Menu handle (blank uses Navigation)',
    logoPosition: 'Logo position (desktop)',
    sticky: 'Sticky header',
    showWishlist: 'Wishlist link',
    showMenuImages: 'Images in the menu dropdowns',
    menuHover: 'Menu hover effect',
    popularTerms: 'Popular searches (comma separated)',
    brandCollections: 'Search: "Shop by brand" collections (blank uses the Brands menu)',
    brandHandle: 'Collection handle',
    brandFallback: 'Brand',
    featureCards: 'Menu feature cards',
    menuItem: 'Menu item it shows under (its title)',
    collection: 'Collection handle (image, title and link when left blank)',
    image: 'Image',
    eyebrow: 'Small line above the label',
    cardLabel: 'Label',
    link: 'Link',
    style: 'Style',
    cardFallback: 'Feature card',
  },
  options: {
    logoPosition: [
      { label: 'Left', value: 'left' },
      { label: 'Centre', value: 'center' },
    ],
    sticky: [
      { label: 'Never', value: 'none' },
      { label: 'Always', value: 'always' },
      { label: 'When scrolling up', value: 'on-scroll-up' },
    ],
    menuHover: [
      { label: 'Glowing underline', value: 'underline' },
      { label: 'Sliding pill', value: 'pill' },
    ],
    style: [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
    showHide: [
      { label: 'Show', value: true },
      { label: 'Hide', value: false },
    ],
  },
} as const
