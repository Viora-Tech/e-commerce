/**
 * SOURCE OF TRUTH KEYWORDS: brand lab copy, brand story band
 * WHAT:  Every default and fixed UI string of the Brand lab section.
 * WHY:   Defaults come from Glide's templates/index.json (the home page instance); logos are
 *        left empty because the theme's shopify:// images do not exist here. Links point at the
 *        collections the theme linked to.
 * WHERE: `components/sections/glide/brand-lab.tsx`, `sections/glide/brand-lab.tsx`.
 */
export const brandLabContent = {
  label: 'Brand lab',
  heading: 'The Glasspad Lab',
  intro:
    '<p>India’s glasspad specialist. We offer the largest and highest-quality selections of glasspads in the country, featuring renowned brands like Pulsar, Dysphoria, GLSSWRKS, Kanami alongside emerging premium brands such as Kyomi, and Aeperion along with many more!</p>',
  ctaLabel: 'View More',
  ctaHref: '/collections/glass-mousepads',
  empty: 'Add a brand with a name to fill this section.',
  newBrand: 'New brand',
  brands: [
    {
      name: 'Dysphoria',
      description: 'The Fastest Glide in the Game, smooth and textured, coated and uncoated!',
      href: '/collections/dysphoria',
    },
    {
      name: 'Pulsar',
      description: 'Esports-Proven Pads with the Highest Quality Famously Known as -  SUPERGLIDE',
      href: '/collections/pulsar-mousepads',
    },
    {
      name: 'Midori',
      description: 'Built slowly. Designed with intention. For those who notice the details.',
      href: '/collections/midori',
    },
    {
      name: 'Abyss Gaming',
      description: 'Hand Crafted Designs, Premium Performance!',
      href: '/collections/abyssgaming',
    },
    {
      name: 'GLSSWRKS',
      description: 'Glass mousepads, redefined.',
      href: '/collections/glsswrks',
    },
    {
      name: 'Hachiware',
      description: 'Top Tier Artwork and Performance at a Budget.',
      href: '/collections/hachiware',
    },
    {
      name: 'Kanami',
      description: 'Balanced Control, Premium Experience with Beautiful Designs.',
      href: '/collections/kanami',
    },
    {
      name: 'Yuki Aim',
      description: 'Premium build, artist editions built with and for Pro Players.',
      href: '/collections/yuki-aim',
    },
  ],
  fields: {
    heading: 'Heading',
    intro: 'Intro',
    ctaLabel: 'Button label',
    ctaHref: 'Button link',
    brands: 'Brands',
    brand: 'Brand',
    name: 'Brand name',
    description: 'One line about the brand',
    logo: 'Logo',
    href: 'Link',
  },
} as const
