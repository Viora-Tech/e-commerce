'use client'

import {
  Badge,
  BlockStack,
  Box,
  Card,
  Divider,
  InlineStack,
  Layout,
  Page,
  Text,
  Toast,
} from '@shopify/polaris'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type Order = NonNullable<Awaited<ReturnType<typeof api.orders.get>>>
type Status = Order['status']

const NEXT: Partial<Record<Status, { label: string; to: Status }>> = {
  placed: { label: 'Mark as paid', to: 'paid' },
  paid: { label: 'Mark as fulfilled', to: 'fulfilled' },
  fulfilled: { label: 'Mark as delivered', to: 'delivered' },
}

const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1)

export function OrderView({ order }: { order: Order }) {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)
  const next = NEXT[order.status]

  async function move(to: Status) {
    await api.orders.setStatus({ id: order.id, status: to })
    setToast(`Order marked as ${to}`)
    router.refresh()
  }

  return (
    <Page
      backAction={{ content: 'Orders', url: '/orders' }}
      title={`#${order.number}`}
      subtitle={new Date(order.placedAt).toLocaleString('en-IN')}
      titleMetadata={
        <Badge tone={order.status === 'cancelled' ? 'critical' : 'info'}>{cap(order.status)}</Badge>
      }
      primaryAction={next ? { content: next.label, onAction: () => move(next.to) } : undefined}
      secondaryActions={
        order.status !== 'cancelled' && order.status !== 'delivered'
          ? [{ content: 'Cancel order', destructive: true, onAction: () => move('cancelled') }]
          : []
      }
    >
      {toast ? <Toast content={toast} onDismiss={() => setToast(null)} /> : null}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Items
                </Text>
                {order.lines.map((l) => (
                  <InlineStack key={l.id} align="space-between" blockAlign="center">
                    <BlockStack gap="050">
                      <Text as="span" fontWeight="semibold">
                        {l.title}
                      </Text>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {l.variantTitle && l.variantTitle !== 'Default' ? l.variantTitle : ''}
                        {' · '}
                        {formatPaise(l.unitPricePaise)} × {l.quantity}
                      </Text>
                    </BlockStack>
                    <Text as="span">{formatPaise(l.unitPricePaise * l.quantity)}</Text>
                  </InlineStack>
                ))}
                <Divider />
                <InlineStack align="space-between">
                  <Text as="span">Subtotal</Text>
                  <Text as="span">{formatPaise(order.subtotalPaise)}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Shipping</Text>
                  <Text as="span">{formatPaise(order.shippingPaise)}</Text>
                </InlineStack>
                {order.paymentAdjustmentPaise !== 0 ? (
                  <InlineStack align="space-between">
                    <Text as="span">
                      {order.paymentAdjustmentLabel ??
                        (order.paymentAdjustmentPaise < 0 ? 'Payment discount' : 'Payment fee')}
                    </Text>
                    <Text as="span">
                      {order.paymentAdjustmentPaise < 0 ? '−' : '+'}
                      {formatPaise(Math.abs(order.paymentAdjustmentPaise))}
                    </Text>
                  </InlineStack>
                ) : null}
                <InlineStack align="space-between">
                  <Text as="span" fontWeight="semibold">
                    Total
                  </Text>
                  <Text as="span" fontWeight="semibold">
                    {formatPaise(order.totalPaise)}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Payment
                </Text>
                {order.payments.map((p) => (
                  <InlineStack key={p.id} align="space-between">
                    <Text as="span">
                      {p.provider === 'cod' ? 'Cash on delivery' : cap(p.provider)} ·{' '}
                      {p.providerRef}
                    </Text>
                    <Badge
                      tone={
                        p.status === 'captured'
                          ? 'success'
                          : p.status === 'refunded'
                            ? 'critical'
                            : 'attention'
                      }
                    >
                      {cap(p.status)}
                    </Badge>
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">
                  Customer
                </Text>
                <Text as="p">{order.customer?.name ?? 'Guest'}</Text>
                <Text as="p" tone="subdued">
                  {order.email}
                </Text>
                <Text as="p" tone="subdued">
                  {order.phone}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">
                  Shipping address
                </Text>
                {order.shippingAddress ? (
                  <Box>
                    <Text as="p">{order.shippingAddress.name}</Text>
                    <Text as="p">{order.shippingAddress.line1}</Text>
                    {order.shippingAddress.line2 ? (
                      <Text as="p">{order.shippingAddress.line2}</Text>
                    ) : null}
                    <Text as="p">
                      {order.shippingAddress.city}, {order.shippingAddress.stateCode}{' '}
                      {order.shippingAddress.pincode}
                    </Text>
                    <Text as="p">{order.shippingAddress.phone}</Text>
                  </Box>
                ) : (
                  <Text as="p" tone="subdued">
                    No address
                  </Text>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
