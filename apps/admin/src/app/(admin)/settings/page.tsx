'use client'

import { BlockStack, Card, Page, Text } from '@shopify/polaris'
import Link from 'next/link'

const SECTIONS = [
  {
    href: '/settings/payments',
    title: 'Payments',
    body: 'Cash on delivery, Razorpay and other gateways.',
  },
  {
    href: '/settings/shipping',
    title: 'Shipping',
    body: 'Couriers, delivery estimates and dispatch policy.',
  },
  {
    href: '/settings/notifications',
    title: 'Notifications',
    body: 'Order emails and WhatsApp messages to shoppers.',
  },
  { href: '/online-store/themes', title: 'Theme', body: 'Colour schemes, fonts and dark mode.' },
]

export default function SettingsPage() {
  return (
    <Page title="Settings">
      <BlockStack gap="400">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card>
              <BlockStack gap="100">
                <Text as="h2" variant="headingSm">
                  {s.title}
                </Text>
                <Text as="p" tone="subdued">
                  {s.body}
                </Text>
              </BlockStack>
            </Card>
          </Link>
        ))}
      </BlockStack>
    </Page>
  )
}
