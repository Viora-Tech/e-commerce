'use client'

import { BlockStack, Card, InlineGrid, Page, Text } from '@shopify/polaris'

export function HomePage({
  storeName,
  role,
  productCount,
}: {
  storeName: string
  role: string
  productCount: number
}) {
  const stat = (label: string, value: string) => (
    <Card>
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingXl">
          {value}
        </Text>
      </BlockStack>
    </Card>
  )
  return (
    <Page title={`Hi, ${storeName}`} subtitle={`You are ${role} of this store.`}>
      <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
        {stat('Products', String(productCount))}
        {stat('Orders today', '0')}
        {stat('Sessions', '—')}
      </InlineGrid>
    </Page>
  )
}
