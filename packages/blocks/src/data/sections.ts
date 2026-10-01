/** Default copy the section library starts a new section with, and the strings it shows. */
export const sectionsContent = {
  announcement: { text: 'Free shipping on prepaid orders above Rs 999', linkLabel: 'Shop now' },
  imageBanner: {
    heading: 'Built for the grind',
    text: 'Glass pads, skates and grips tuned by players.',
    button: 'Shop the range',
  },
  imageWithText: {
    heading: 'Made in small batches',
    text: 'Every pad is tempered, etched and checked by hand before it ships.',
    button: 'Our story',
  },
  multicolumn: {
    heading: 'Why players switch',
    columns: [
      { title: 'Tempered glass', text: 'Smooth glide that stays consistent for years.' },
      { title: 'Fast shipping', text: 'Dispatched within 24 hours from Bengaluru.' },
      { title: 'Easy returns', text: 'Seven day returns on unused products.' },
    ],
  },
  collectionList: { heading: 'Shop by collection', empty: 'Pick collections in the editor.' },
  featuredProduct: { kicker: 'Featured', button: 'View product', empty: 'Pick a product.' },
  testimonials: {
    heading: 'Loved by players',
    items: [
      {
        quote: 'The glide is unreal. Never going back to cloth.',
        author: 'Aarav',
        role: 'Valorant',
      },
      { quote: 'Arrived in two days, packed like a phone.', author: 'Meera', role: 'CS2' },
    ],
  },
  logoList: { heading: 'As seen on' },
  faq: {
    heading: 'Questions',
    items: [
      { question: 'How long does shipping take?', answer: 'Most orders arrive in 2 to 5 days.' },
      { question: 'Can I return a product?', answer: 'Yes, within seven days if unused.' },
    ],
  },
  video: { heading: '', empty: 'Add a YouTube, Vimeo or MP4 link.' },
  newsletter: {
    heading: 'Join the list',
    text: 'Drops, restocks and the occasional discount. No spam.',
    button: 'Subscribe',
    placeholder: 'Email address',
    label: 'Email',
    done: 'Almost done. Check your inbox and tap the link we sent to confirm.',
    failed: 'Enter a valid email address.',
  },
  related: { heading: 'You may also like' },
  recentlyViewed: { heading: 'Recently viewed' },
  footer: { tagline: 'Gaming peripherals built for the grind.' },
} as const
