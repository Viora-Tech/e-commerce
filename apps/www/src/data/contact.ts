import { siteConfig } from '@commerce/config/site'

const docs = siteConfig.urls.docs

export const contactContent = {
  status: 'Support by email and phone',
  title: 'Talk to a human.',
  subtitle:
    'Moving from Shopify, choosing a plan or stuck on a setting — a real person on our team replies.',
  channels: [
    {
      key: 'email',
      title: 'Email',
      body: `${siteConfig.contact.supportEmail} — we answer every email.`,
      cta: 'Write to us →',
    },
    {
      key: 'phone',
      title: 'Phone',
      body: `${siteConfig.contact.phone}, Monday to Saturday, 10 am to 7 pm IST.`,
      cta: 'Call us →',
    },
  ],
  company: {
    title: 'Business details',
    rows: [
      { label: 'Business', value: siteConfig.company.legalName },
      { label: 'Based in', value: siteConfig.company.publicAddress },
      { label: 'Phone', value: siteConfig.contact.phone },
      { label: 'Email', value: siteConfig.contact.supportEmail },
      { label: 'GSTIN', value: siteConfig.company.gstin },
    ],
  },
  form: {
    title: 'Send us a message',
    topicLabel: 'What’s it about?',
    topics: ['Sales', 'Support', 'Partnerships', 'Press'],
    name: { label: 'Your name', placeholder: 'Riya Sharma' },
    email: { label: 'Email', placeholder: 'you@yourstore.in' },
    store: { label: 'Your store link (optional)', placeholder: 'yourstore.in' },
    message: { label: 'Message', placeholder: 'Tell us about your store and what you need.' },
    consent: 'You can contact me about this request.',
    submit: 'Send message',
    sending: 'Sending…',
    success: 'Thanks. Your message is in; a real person will reply.',
    error: 'Your message did not go through. Try again in a moment, or email support@koomerce.app.',
    invalid: {
      name: 'Enter your name',
      email: 'Enter a valid email address',
      message: 'Tell us a little more',
      consent: 'Tick this so we can reply',
    },
  },
  quick: {
    eyebrow: 'Quick answers',
    title: 'Maybe it’s already in the docs.',
    links: [
      {
        label: 'How do I move from Shopify?',
        href: `${docs}/merchant-guide/start-here/move-from-shopify`,
      },
      { label: 'Which couriers can I connect?', href: `${docs}/merchant-guide/apps/couriers` },
      {
        label: 'How does GST invoicing work?',
        href: `${docs}/merchant-guide/money-and-gst/gst-invoices`,
      },
      {
        label: 'Can I use my own domain?',
        href: `${docs}/merchant-guide/online-store/preferences`,
      },
    ],
  },
}
