/** Copy and fixed UI strings for Drops teaser (sections/drops-teaser.liquid, snippets/drop-card.liquid). */
export const dropsTeaserContent = {
  label: 'Drops teaser',
  eyebrow: 'Coming up',
  heading: 'Next drops',
  roadmapLink: '/pages/roadmap',
  roadmapLabel: 'Full roadmap',
  /** Link text a card falls back to when it has a link but no label. */
  linkLabelFallback: 'Notify me',
  empty: 'Add a drop to show what is coming.',
  statuses: {
    coming: 'Coming',
    preorder: 'Pre-order open',
    shipping: 'Shipping now',
  },
  statusOptions: [
    { label: 'Coming', value: 'coming' },
    { label: 'Pre-order open', value: 'preorder' },
    { label: 'Shipping now', value: 'shipping' },
  ],
  /** Chip colour per status, as the theme's status-chip tones. */
  tones: { coming: 'neutral', preorder: 'brand', shipping: 'in' },
  newDrop: {
    period: 'October 2026',
    title: 'Product name',
    text: '',
    status: 'coming',
    link: '',
    linkLabel: 'Notify me',
  },
  drops: [
    {
      period: 'September 2026',
      title: 'Waimers 2.0!',
      text: 'Our new website is live <3',
      status: 'coming',
      link: '',
      linkLabel: 'Notify me',
    },
    {
      period: 'September 2026',
      title: 'Wooting 60HE v2 - batch 1',
      text: 'Wooting 60 HE v2 now in stock!',
      status: 'shipping',
      link: '/pages/preorder-updates',
      linkLabel: 'Notify me',
    },
    {
      period: 'October 2026',
      title: 'RAWM Leviathan V4 GT',
      text: "RAWM's first optical-magnetic switch mouse, here by the first week of October.",
      status: 'coming',
      link: '/products/rawm-leviathan-v4-gt-dual-8k-lightweight-wireless-gaming-mouse-hyper-click',
      linkLabel: 'Check Leviathan v4 here',
    },
    {
      period: 'October 2026',
      title: 'Hachiware glasspads',
      text: 'Elisa, Ice and Hanabi land around the second week of October.',
      status: 'coming',
      link: '/pages/preorder-updates',
      linkLabel: 'Notify me',
    },
  ],
  maxDrops: 4,
} as const
