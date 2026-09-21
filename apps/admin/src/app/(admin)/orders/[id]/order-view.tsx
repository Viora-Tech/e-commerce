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
import { ShipmentPanel } from '@/components/orders/shipment-panel'
import { shipmentPanelContent } from '@/data/shipping'
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
  const [busy, setBusy] = useState(false)
  const next = NEXT[order.status]

  async function move(to: Status) {
    await api.orders.setStatus({ id: order.id, status: to })
    setToast(`Order marked as ${to}`)
    router.refresh()
  }

  /** Courier calls can fail; the message is the app's wording from the API, shown as a toast. */
  async function courier<T>(run: () => Promise<T>, done: (result: T) => string) {
    setBusy(true)
    try {
      setToast(done(await run()))
      router.refresh()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Courier request failed')
    } finally {
      setBusy(false)
    }
  }
  const shipmentId = order.shipment?.id
  const handleBook = () =>
    courier(
      () => api.orders.createShipment({ orderId: order.id }),
      (s) => shipmentPanelContent.booked(s.waybill),
    )
  const handleRefresh = () =>
    shipmentId &&
    courier(
      () => api.orders.refreshTracking({ shipmentId }),
      () => 'Tracking updated',
    )
  const handleCancel = () =>
    shipmentId &&
    courier(
      () => api.orders.cancelShipment({ shipmentId }),
      () => shipmentPanelContent.cancelled,
    )

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

            <ShipmentPanel
              orderStatus={order.status}
              shipment={order.shipment}
              busy={busy}
              onBook={handleBook}
              onRefresh={handleRefresh}
              onCancel={handleCancel}
            />

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
