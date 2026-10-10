/** Copy and fixed UI strings for Promo bento (sections/promo-bento.liquid). */
export const promoBentoContent = {
  label: 'Promo bento',
  heading: '',
  subheading: '',
  empty: 'Add a tile to build your mosaic.',
  imageSizes: '(min-width: 750px) 50vw, 100vw',
  tiles: [
    { collectionHandle: 'mice', size: 'tall', title: 'MICE' },
    { collectionHandle: 'keyboard', size: 'wide', title: 'KEYBOARD' },
    { collectionHandle: 'mousepads', size: 'wide', title: 'MOUSEPAD' },
    { collectionHandle: 'accessories', size: 'tall', title: 'ACCESSORIES' },
  ],
  newTile: {
    collectionHandle: '',
    productHandle: '',
    videoUrl: '',
    imageFit: 'cover',
    textTheme: 'light',
    size: 'small',
    showText: true,
    eyebrow: '',
    title: '',
    subtitle: '',
    link: '',
  },
  sizes: [
    { label: 'Small (1 x 1)', value: 'small' },
    { label: 'Wide (2 x 1)', value: 'wide' },
    { label: 'Tall (1 x 2)', value: 'tall' },
    { label: 'Large (2 x 2)', value: 'large' },
  ],
  fits: [
    { label: 'Fill the tile (crops)', value: 'cover' },
    { label: 'Show the whole product', value: 'contain' },
  ],
  textThemes: [
    { label: 'White (for dark images)', value: 'light' },
    { label: 'Black (for light images)', value: 'dark' },
  ],
  reveals: [
    { label: 'Always visible', value: 'always' },
    { label: 'On hover', value: 'hover' },
  ],
  maxTiles: 12,
} as const
