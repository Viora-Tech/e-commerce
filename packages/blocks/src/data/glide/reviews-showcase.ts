/** Copy and defaults for the Reviews showcase section (Port of sections/reviews-showcase.liquid). */

export const reviewsShowcaseContent = {
  eyebrow: 'Loved by players across India',
  summaryBefore: 'From',
  summaryAfter: 'reviews',
  verifiedSuffix: 'verified buyers',
  rating: 4.9,
  reviewCount: 12,
  verifiedCount: 12,
  speed: 70,
  allButton: { label: 'See all reviews', href: '/pages/reviews' },
  writeButton: { label: 'Write a review', href: '' },
  browserLabel: 'yourstore.com/reviews',
  scoreOutOf: '/ 5',
  verifiedBuyer: 'Verified buyer',
  groupLabel: 'Customer reviews',
  photoCounter: (current: number, total: number) => `${current} / ${total}`,
  scoreLabel: (rating: string, count: number) => `${rating} out of 5 from ${count} reviews`,
  ratingLabel: (rating: number) => `${rating} out of 5 stars`,
  photoAlt: (name: string, product: string) =>
    product ? `Photo from ${name}'s review of ${product}` : `Photo from ${name}'s review`,
  tipDetail: (rating: number, product: string) =>
    product ? `${rating}★ · ${product}` : `${rating}★`,
  more: (count: number) => `+${count}`,
  starGlyph: '★',
  reviews: [
    {
      title: 'Feels lighter than it is',
      quote:
        'Switched from a mouse twice the weight and my wrist pain is gone. The shape fits a claw grip perfectly and the sensor never skips.',
      name: 'Aarav M.',
      rating: 5,
      verified: true,
      productName: 'Pulsar X2 mouse',
      productHref: '/collections/mice',
    },
    {
      title: 'Glass pad is the real deal',
      quote:
        'Glide is unreal and it stays clean with a quick wipe. Two months in and it still looks new. Worth every rupee.',
      name: 'Rohan K.',
      rating: 5,
      verified: true,
      productName: 'Glass mousepad',
      productHref: '/collections/glass-mousepads',
    },
    {
      title: 'Great typing feel',
      quote:
        'The keyboard sounds creamy out of the box and the build is solid. Hot-swap switches made it easy to tune.',
      name: 'Sneha P.',
      rating: 5,
      verified: true,
      productName: 'Wired keyboard',
      productHref: '/collections/keyboard',
    },
    {
      title: 'Fast delivery, neat packaging',
      quote:
        'Ordered on Monday, in my hands by Wednesday. Everything was packed carefully and the support team answered within minutes.',
      name: 'Vikram S.',
      rating: 5,
      verified: true,
      productName: '',
      productHref: '',
    },
    {
      title: 'Big upgrade for my aim',
      quote:
        'Went up two ranks in a month. The cloth pad has just the right amount of control and the stitched edges are clean.',
      name: 'Ishita D.',
      rating: 4,
      verified: true,
      productName: 'Cloth mousepad',
      productHref: '/collections/mousepads',
    },
    {
      title: 'Solid for the price',
      quote:
        'I was sceptical about buying a mouse online but the quality is on par with brands that cost double. Buttons are crisp.',
      name: 'Karan T.',
      rating: 4,
      verified: true,
      productName: 'Pulsar X2 mouse',
      productHref: '/collections/mice',
    },
    {
      title: 'Exactly as described',
      quote:
        'Colours match the photos, the cable is flexible and nothing rattles. Happy with it and already eyeing the next one.',
      name: 'Meera J.',
      rating: 5,
      verified: false,
      productName: 'Wired keyboard',
      productHref: '/collections/keyboard',
    },
    {
      title: 'Perfect for long sessions',
      quote:
        'Eight hours a day for work and games and my hand stays comfortable. The matte coating does not get greasy.',
      name: 'Arjun N.',
      rating: 5,
      verified: true,
      productName: 'Pulsar X2 mouse',
      productHref: '/collections/mice',
    },
    {
      title: 'Smooth and quiet',
      quote:
        'Quiet enough for late-night games without waking anyone. The base grips the desk and does not slide around.',
      name: 'Pooja R.',
      rating: 4,
      verified: true,
      productName: 'Cloth mousepad',
      productHref: '/collections/mousepads',
    },
    {
      title: 'Bought a second one',
      quote:
        'Got one for myself and one for my brother after he would not stop borrowing mine. That says it all.',
      name: 'Dev A.',
      rating: 5,
      verified: true,
      productName: 'Glass mousepad',
      productHref: '/collections/glass-mousepads',
    },
    {
      title: 'Love the details',
      quote:
        'From the unboxing to the feet of the keyboard, you can tell someone cared. Software is simple and just works.',
      name: 'Nisha B.',
      rating: 5,
      verified: true,
      productName: 'Wired keyboard',
      productHref: '/collections/keyboard',
    },
    {
      title: 'No more double clicks',
      quote:
        'My old mouse started double clicking after a year. This one has been flawless so far and tracks perfectly.',
      name: 'Tarun G.',
      rating: 4,
      verified: true,
      productName: 'Pulsar X2 mouse',
      productHref: '/collections/mice',
    },
  ],
} as const
