/** Default copy for the "modern" section batch (`../sections/modern.tsx`). Plain words, works for any merchant. */
export const modernSectionsContent = {
  spotlightHero: {
    eyebrow: 'Pro series',
    heading: 'Gear that keeps up with you',
    text: 'Built for long sessions and fast reflexes — precision gear, tested by players.',
    primary: 'Shop the range',
    secondary: 'Learn more',
  },
  splitHero: {
    eyebrow: 'New drop',
    heading: 'Precision, out of the box',
    text: 'Every piece is tuned and checked by hand before it ships to you.',
    button: 'Shop now',
    secondary: 'Learn more',
    trust: ['COD available', '7-day returns', '1-year warranty'],
  },
  videoHero: {
    eyebrow: 'Now showing',
    heading: 'See it in motion',
    text: 'Smooth, consistent, built to last through every match.',
    button: 'Watch the range',
    secondary: 'Learn more',
  },
  bentoGrid: {
    heading: 'Why players switch',
    tiles: [
      {
        title: 'Tempered glass',
        text: 'Smooth glide that stays consistent for years.',
        size: 'wide',
      },
      { title: 'Fast shipping', text: 'Dispatched within 24 hours.', size: 'small' },
      { title: 'Easy returns', text: 'Seven day returns on unused products.', size: 'small' },
      { title: 'Built to last', text: 'Tested for thousands of hours of play.', size: 'tall' },
      {
        title: 'Community favourite',
        text: 'Rated 4.8 out of 5 by 2,000+ players.',
        size: 'small',
      },
      {
        title: 'Worldwide shipping',
        text: 'We deliver across the country and beyond.',
        size: 'small',
      },
    ],
  },
  logoMarquee: { heading: 'Trusted by teams and players' },
  testimonialMarquee: {
    heading: 'Loved by players',
    items: [
      { quote: 'The glide is unreal. Never going back.', author: 'Aarav', role: 'Valorant' },
      { quote: 'Arrived in two days, packed like a phone.', author: 'Meera', role: 'CS2' },
      { quote: 'Best upgrade to my setup this year.', author: 'Rohan', role: 'Apex' },
      { quote: 'Consistent glide even after months of use.', author: 'Simran', role: 'Fortnite' },
    ],
  },
  statsCounter: {
    heading: 'Numbers that speak',
    stats: [
      { value: 50000, prefix: '', suffix: '+', label: 'Orders shipped' },
      { value: 4.8, prefix: '', suffix: '/5', label: 'Average rating' },
      { value: 24, prefix: '', suffix: 'hr', label: 'Dispatch time' },
      { value: 7, prefix: '', suffix: ' days', label: 'Easy returns' },
    ],
  },
  faqAccordion: {
    heading: 'Questions',
    intro: 'Can’t find what you’re looking for? Reach out to our support team any time.',
    items: [
      { question: 'How long does shipping take?', answer: 'Most orders arrive in 2 to 5 days.' },
      { question: 'Can I return a product?', answer: 'Yes, within seven days if unused.' },
      {
        question: 'Do you ship internationally?',
        answer: 'We currently ship within the country only.',
      },
    ],
  },
  ctaBanner: {
    kicker: 'Limited time',
    heading: 'Ready to upgrade your setup?',
    text: 'Join thousands of players who made the switch.',
    button: 'Shop now',
  },
  gallery: {
    heading: 'The lookbook',
    images: [
      { alt: 'Product shot one', caption: 'The everyday carry' },
      { alt: 'Product shot two', caption: 'Studio setup' },
      { alt: 'Product shot three', caption: 'On the desk' },
      { alt: 'Product shot four', caption: 'In action' },
    ],
  },
} as const
