import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name

export const aboutContent = {
  eyebrow: `About ${brand}`,
  title: ['Commerce', 'for everyone.'],
  subtitle:
    'An AI-powered store, built in India, for anyone who sells — a home baker, a sneaker brand, a teacher with a course.',
  story: {
    eyebrow: 'Our story',
    title: 'From one store to a platform.',
    items: [
      {
        title: 'Waimers is born',
        body: 'We start selling gaming glasspads from India.',
      },
      {
        title: 'Waimers on Shopify',
        body: 'Apps for UPI, GST, couriers and WhatsApp pile up — each with its own bill.',
      },
      {
        title: `We start building ${brand}`,
        body: 'One store where Indian checkout, shipping and GST already work — and where you can ask your store anything.',
      },
      {
        title: 'First store live',
        body: `Waimers moves to ${brand}, same look, its own checkout.`,
      },
    ],
  },
  values: {
    eyebrow: 'What we believe',
    title: 'Four rules we build by.',
    items: [
      {
        icon: 'plain',
        title: 'Plain words',
        body: 'No jargon in the admin. If a merchant has to google it, we rename it.',
      },
      {
        icon: 'approve',
        title: 'You approve',
        body: `${brand} AI prepares changes. Nothing changes until you say yes.`,
      },
      {
        icon: 'india',
        title: 'Built for India',
        body: 'UPI, GST, COD, Indian couriers and हिन्दी are part of the product.',
      },
      {
        icon: 'anything',
        title: 'Sell anything',
        body: 'Physical goods today; subscriptions, downloads and services next.',
      },
    ],
  },
  madeIn: [
    { label: 'Built in', value: 'India' },
    { label: 'Hosted in', value: 'Mumbai · AWS ap-south-1' },
    { label: 'Languages', value: 'English · हिन्दी' },
    { label: 'Currency', value: 'INR · GST-ready' },
  ],
  firstStore: {
    eyebrow: `First store on ${brand}`,
    name: 'Waimers',
    body: `Gaming mice and desk gear. Same look as their Shopify theme, now on ${brand}’s own checkout and couriers. Running live on waimers.in.`,
    visit: 'Visit waimers.in',
    href: 'https://waimers.in',
  },
  cta: { title: 'Be one of the first stores.' },
}
