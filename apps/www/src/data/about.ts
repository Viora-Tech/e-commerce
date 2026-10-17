import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name
const domain = siteConfig.brand.domain

export const aboutContent = {
  eyebrow: `About ${brand}`,
  title: ['Commerce', 'for everyone.'],
  subtitle:
    'An AI-powered store, built in India, for anyone who sells — a home baker, a sneaker brand, a teacher with a course.',
  story: {
    eyebrow: 'Our story',
    title: 'From one store to a platform.',
    note: 'Placeholder dates and copy — owner to confirm.',
    items: [
      {
        when: '[Year]',
        title: 'Waimers is born',
        body: 'We start selling gaming glasspads from India.',
      },
      {
        when: '[Year]',
        title: 'Waimers on Shopify',
        body: 'Apps for UPI, GST, couriers and WhatsApp pile up — each with its own bill.',
      },
      {
        when: '[Year]',
        title: `We start building ${brand}`,
        body: 'One store where Indian checkout, shipping and GST already work — and where you can ask your store anything.',
      },
      {
        when: '[Date]',
        title: 'First store live',
        body: `Waimers moves to ${brand}, same look, its own checkout.`,
      },
    ],
  },
  founder: {
    photo: 'Founder photo',
    eyebrow: 'A note from the founder',
    // PLACEHOLDER: replace with the founder's own words.
    quote: [
      `“[Placeholder] I built ${brand} because running Waimers meant juggling a dozen tools that were never made for India. I wanted a store that speaks our language — UPI first, GST done right, couriers that actually deliver.`,
      `${brand} is that store. It’s for anyone with something to sell, whether that’s their first product or their thousandth order.”`,
    ],
    name: '[Founder name]',
    role: `[Founder name] · Founder, ${brand}`,
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
    // PLACEHOLDER: the go-live date is set by the owner.
    body: `Gaming glasspads, made for Indian gamers. Same look as their Shopify theme, now on ${brand}’s own checkout and couriers. [Placeholder — live since [date]]`,
    visit: `Visit waimers.${domain}`,
    href: `https://waimers.${domain}`,
  },
  cta: { title: 'Be one of the first stores.' },
}
