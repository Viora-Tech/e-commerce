'use client'

import type { Tracking } from '@commerce/core'
import {
  Badge,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  InlineStack,
  Link,
  Text,
} from '@shopify/polaris'
import { shipmentPanelContent as copy } from '@/data/shipping'
import type { api } from '@/lib/api-client'

type Shipment = NonNullable<NonNullable<Awaited<ReturnType<typeof api.orders.get>>>['shipment']>

type ShipmentPanelProps = {
  orderStatus: string
  shipment: Shipment | null
  busy: boolean
  onBook: () => void
  onRefresh: () => void
  onCancel: () => void
}

const TONE: Record<string, 'success' | 'critical' | 'attention' | 'info'> = {
  delivered: 'success',
  rto: 'critical',
  cancelled: 'critical',
  created: 'attention',
}

const when = (iso: string | Date) => new Date(iso).toLocaleString('en-IN')

/** Book, refresh or cancel the consignment for an order, and show the courier's scans. */
export function ShipmentPanel({
  orderStatus,
  shipment,
  busy,
  onBook,
  onRefresh,
  onCancel,
}: ShipmentPanelProps) {
  const tracking = (shipment?.tracking ?? null) as Tracking | null
  const open = shipment && shipment.status !== 'cancelled' && shipment.status !== 'delivered'
  const canBook = !shipment || shipment.status === 'cancelled'
  const bookable = canBook && orderStatus !== 'cancelled' && orderStatus !== 'delivered'

  if (!shipment || canBook) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">
            {copy.heading}
          </Text>
          <Text as="p" tone="subdued">
            {copy.none}
          </Text>
          {bookable ? (
            <Button variant="primary" onClick={onBook} loading={busy}>
              {busy ? copy.booking : copy.book}
            </Button>
          ) : null}
        </BlockStack>
      </Card>
    )
  }

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            {copy.heading}
          </Text>
          <Badge tone={TONE[shipment.status] ?? 'info'}>
            {copy.status[shipment.status] ?? shipment.status}
          </Badge>
        </InlineStack>
        <BlockStack gap="100">
          <Text as="p">
            {copy.courier}: {shipment.provider} · {copy.waybill}: <code>{shipment.waybill}</code>
          </Text>
          <Text as="p" tone="subdued" variant="bodySm">
            {copy.updated} {when(shipment.updatedAt)}
            {tracking?.expectedDate ? ` · ${copy.expected} ${tracking.expectedDate}` : ''}
          </Text>
          <InlineStack gap="300">
            {shipment.labelUrl ? (
              <Link url={shipment.labelUrl} target="_blank">
                {copy.label}
              </Link>
            ) : null}
            {shipment.trackingUrl ? (
              <Link url={shipment.trackingUrl} target="_blank">
                {copy.track}
              </Link>
            ) : null}
          </InlineStack>
        </BlockStack>
        {open ? (
          <ButtonGroup>
            <Button onClick={onRefresh} loading={busy}>
              {copy.refresh}
            </Button>
            <Button tone="critical" onClick={onCancel} disabled={busy}>
              {copy.cancel}
            </Button>
          </ButtonGroup>
        ) : null}
        <BlockStack gap="100">
          <Text as="h3" variant="headingXs">
            {copy.events}
          </Text>
          {tracking?.events.length ? (
            tracking.events
              .slice()
              .reverse()
              .map((e) => (
                <Text key={`${e.at}-${e.description}`} as="p" variant="bodySm">
                  {when(e.at)} · {copy.status[e.status] ?? e.status}
                  {e.location ? ` · ${e.location}` : ''}
                  {e.description ? ` — ${e.description}` : ''}
                </Text>
              ))
          ) : (
            <Text as="p" tone="subdued" variant="bodySm">
              {copy.noEvents}
            </Text>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  )
}
