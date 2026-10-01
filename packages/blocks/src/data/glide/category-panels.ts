/** Copy and fixed UI strings for Category panels (sections/category-panels.liquid). */
export const categoryPanelsContent = {
  label: 'Category panels',
  kicker: '',
  heading: 'Pick your gear',
  /** Shown on a panel with no line of its own. `{count}` is the collection's product count. */
  countLine: '{count} products',
  cta: 'Shop',
  empty: 'Add a category to show it here.',
  newPanel: { collectionHandle: '', title: 'Category', text: '' },
  panels: [
    { collectionHandle: 'mice', title: 'Mice', text: '' },
    { collectionHandle: 'glass-mousepads', title: 'Glasspads', text: 'Glass and hybrid' },
    { collectionHandle: 'cloth-mousepads', title: 'Cloth pads', text: 'Speed to control' },
    { collectionHandle: 'keyboard', title: 'Keyboards', text: 'Hall effect and mechanical' },
    {
      collectionHandle: 'accessories',
      title: 'Accessories',
      text: 'Skates, grips, sleeves and more',
    },
    { collectionHandle: 'skates', title: 'Skates', text: 'Glide upgrades for every shell' },
  ],
  imageSizes: '(min-width: 990px) 45vw, 100vw',
  maxPanels: 6,
} as const
