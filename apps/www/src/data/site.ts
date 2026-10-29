import { siteConfig } from '@commerce/config/site'

const docs = siteConfig.urls.docs

export const siteContent = {
  brand: siteConfig.brand.name,
  tagline: siteConfig.brand.tagline,
  supportEmail: siteConfig.contact.supportEmail,
  phone: siteConfig.contact.phone,
  legalName: siteConfig.company.legalName,
  address: siteConfig.company.publicAddress,
  navLinks: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Apps', href: '/apps' },
    { label: 'Docs', href: docs },
  ],
  signIn: { label: 'Sign in', href: `${siteConfig.urls.admin}/login` },
  // Sign-in creates the account; the admin then walks a new merchant through creating a store.
  startFree: { label: 'Start free', href: `${siteConfig.urls.admin}/login` },
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
      title: 'Solutions',
      links: [
        { label: 'Shopify alternative', href: '/solutions/shopify-alternative-india' },
        { label: 'GST invoices', href: '/solutions/gst-invoicing' },
        { label: 'UPI checkout', href: '/solutions/upi-checkout' },
        { label: 'Indian couriers', href: '/solutions/indian-couriers' },
        { label: 'Hindi admin', href: '/solutions/hindi-ecommerce-admin' },
        { label: 'All solutions', href: '/solutions' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Guides', href: '/guides' },
        { label: 'Docs', href: docs },
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
        { label: 'Data deletion', href: '/data-deletion' },
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
