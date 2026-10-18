import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name

export type SecurityNodeKey =
  | 'shopper'
  | 'edge'
  | 'apps'
  | 'access'
  | 'isolation'
  | 'secrets'
  | 'database'
  | 'backups'

export const securityContent = {
  eyebrow: 'Security',
  title: ['Your store’s data,', 'kept safe.'],
  subtitle:
    'How a request travels through ' +
    brand +
    ', and what protects it at every step. Every claim is backed by our engineering docs.',
  diagram: {
    title: 'How a request is protected',
    source: 'Source: engineering docs · Security, Deployment, Backups',
    highlighted: ['isolation', 'secrets'] as readonly SecurityNodeKey[],
    nodes: [
      { key: 'shopper', title: 'Shopper', body: 'Browser or phone' },
      { key: 'edge', title: 'Cloudflare edge', body: 'TLS on every request' },
      { key: 'apps', title: `${brand} apps`, body: 'Storefront, admin, worker' },
      { key: 'access', title: 'Access check', body: 'Session → role → 31 permissions' },
      { key: 'isolation', title: 'Store isolation', body: 'Postgres row-level security' },
      { key: 'secrets', title: 'Encrypted secrets', body: 'AES-256-GCM' },
      { key: 'database', title: 'Database', body: 'Mumbai · AWS ap-south-1' },
    ],
    backup: {
      key: 'backups',
      title: 'Encrypted backups',
      body: 'Encrypted · 7 daily + 4 weekly kept',
    },
  },
  pillars: {
    eyebrow: 'In detail',
    title: 'Six things that keep you safe.',
    items: [
      {
        key: 'india',
        title: 'Hosted in India',
        body: 'Production runs in AWS Mumbai (ap-south-1), close to your shoppers, payment partners and couriers.',
      },
      {
        key: 'isolation',
        title: 'Every store kept apart',
        body: 'Postgres row-level security means one store’s data can never be read by another.',
      },
      {
        key: 'secrets',
        title: 'Encrypted secrets',
        body: 'Payment and courier credentials and customer phone numbers are encrypted with AES-256-GCM.',
      },
      {
        key: 'backups',
        title: 'Encrypted backups',
        body: 'Backups are encrypted; 7 daily and 4 weekly copies are kept.',
      },
      {
        key: 'roles',
        title: 'Roles and permissions',
        body: 'Staff only see what their role allows — 31 separate permissions.',
      },
      {
        key: 'data',
        title: 'Your data, your call',
        body: 'Download everything as one zip, or close your store for good. Built for the DPDP Act, 2023.',
      },
    ],
  },
  report: {
    title: 'Found a security issue?',
    // Support until a security mailbox exists; it is the one address that is routed today.
    body: `Write to ${siteConfig.contact.supportEmail} with the details. Please test only on stores you own.`,
    cta: 'Email us',
    href: `mailto:${siteConfig.contact.supportEmail}`,
  },
}
