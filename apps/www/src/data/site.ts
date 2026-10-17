import { siteConfig } from '@commerce/config/site'

const docs = siteConfig.urls.docs

export const siteContent = {
  brand: siteConfig.brand.name,
  tagline: siteConfig.brand.tagline,
  supportEmail: siteConfig.contact.supportEmail,
  navLinks: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Apps', href: '/apps' },
    { label: 'Docs', href: docs },
  ],
  signIn: { label: 'Sign in', href: `https://${siteConfig.brand.domain}/sign-in` },
  joinWaitlist: 'Join the waitlist',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  footerColumns: [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'App Store', href: '/apps' },
        { label: 'Changelog', href: '/changelog' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Docs', href: docs },
        { label: 'Status', href: siteConfig.urls.status },
        {
          label: 'Shopify import guide',
          href: `${docs}/merchant-guide/online-store/import-a-shopify-theme`,
        },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Security', href: '/security' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Refunds', href: '/refunds' },
        { label: 'Cookies', href: '/cookies' },
        { label: 'Shipping & delivery', href: '/shipping' },
        { label: 'Acceptable use', href: '/acceptable-use' },
      ],
    },
  ],
  cookiePreferences: 'Cookie preferences',
  madeIn: 'Made in India',
  social: [
    { label: 'Instagram', href: siteConfig.social.instagram },
    { label: 'YouTube', href: siteConfig.social.youtube },
    { label: 'X', href: siteConfig.social.x },
    { label: 'LinkedIn', href: siteConfig.social.linkedin },
    { label: 'GitHub', href: siteConfig.social.github },
  ],
}
