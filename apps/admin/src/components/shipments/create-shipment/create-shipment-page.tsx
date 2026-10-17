'use client'

import { PackageOpen, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import OrderChip from '@/components/orders/order-chip'
import {
  EMPTY_TRACKING,
  type TrackingDraft,
  trackingPayload,
} from '@/components/orders/tracking-fields'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CourierStep from './courier-step'
import DoneStep, { type BookedShipment } from './done-step'
import {
  MANUAL,
  type PackageForm,
  type ParcelQuote,
  packageFor,
  parsePackage,
  quoteRequest,
  type ShipmentDraft,
  startingPick,
} from './flow-state'
import PackageStep from './package-step'
import RouteCard from './route-card'
import SummaryCard from './summary-card'

type CreateShipmentPageProps = { orderId: string }

/** Wait this long after the last package edit before asking the couriers again. */
const QUOTE_DEBOUNCE_MS = 600

/**
 * Figma "Orders · Create shipment" (616:16737): one page for one order. Route, package and
 * courier on the left with live rates as the package changes; the summary and Book on the
 * right; once booked, the label and the pickup request take the summary's place.
 */
export default function CreateShipmentPage({ orderId }: CreateShipmentPageProps) {
  // Hooks
  const content = useCopy(createShipmentContent)
  const router = useRouter()
  const [draft, setDraft] = useState<ShipmentDraft | null>(null)
  const [failed, setFailed] = useState(false)
  const [parcelId, setParcelId] = useState<string | null>(null)
  const [form, setForm] = useState<PackageForm | null>(null)
  const [quote, setQuote] = useState<ParcelQuote | null>(null)
  const [pick, setPick] = useState(MANUAL)
  const [tracking, setTracking] = useState<TrackingDraft>(EMPTY_TRACKING)
  const [busy, setBusy] = useState(false)
  const [booked, setBooked] = useState<BookedShipment | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let live = true
    api.shipments
      .prepare({ orderIds: [orderId] })
      .then((d) => {
        if (!live) return
        setDraft(d)
        const first = d.orders[0]?.parcels[0]
        const o = d.orders[0]
        if (o && first) {
          setParcelId(first.id)
          setForm(packageFor(o, first, d))
        }
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [orderId])

  // Live rates: ask again a moment after the package stops changing.
  useEffect(() => {
    const o = draft?.orders[0]
    const p = o?.parcels.find((x) => x.id === parcelId) ?? o?.parcels[0]
    const pkg = form ? parsePackage(form) : null
    if (!draft || !o || !p || !form || !pkg || draft.couriers.length === 0 || retry < 0) return
    let live = true
    setQuote(null)
    const timer = setTimeout(() => {
      api.shipments
        .quote({ parcels: [quoteRequest(o, p, form, pkg)] })
        .then(([answer]) => {
          if (!live) return
          setQuote(answer ?? null)
          setPick((current) =>
            current !== MANUAL && answer?.options.some((r) => r.providerId === current)
              ? current
              : startingPick(answer?.options ?? []),
          )
        })
        .catch((err) => live && toast.error(err instanceof Error ? err.message : String(err)))
    }, QUOTE_DEBOUNCE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [draft, parcelId, form, retry])

  // Event handlers
  const handleParcel = (id: string) => {
    const o = draft?.orders[0]
    const next = o?.parcels.find((p) => p.id === id)
    if (!draft || !o || !next) return
    setParcelId(next.id)
    setForm(packageFor(o, next, draft))
  }
  const handleShipYourself = () => {
    setPick(MANUAL)
    document.getElementById('choose-courier')?.scrollIntoView({ behavior: 'smooth' })
  }
  const handleBook = async () => {
    if (!order || !parcel || !form || !parsed) return
    const typed = trackingPayload(tracking)
    if (pick === MANUAL && (!typed.trackingNumber || !typed.courier)) {
      toast.error(content.courier.manualMissing)
      return
    }
    setBusy(true)
    try {
      if (pick === MANUAL) {
        const r = await api.orders.fulfil({
          orderId: order.orderId,
          lines: parcel.lines.map((l) => ({ lineId: l.id, quantity: l.quantity })),
          ...typed,
        })
        setBooked({
          shipmentId: r.shipmentId,
          courier: typed.courier ?? '',
          waybill: typed.trackingNumber ?? '',
          labelUrl: null,
          trackingUrl: typed.trackingUrl ?? null,
          manual: true,
          canPickup: false,
        })
      } else {
        const s = await api.orders.createShipment({
          orderId: order.orderId,
          providerId: pick,
          fulfillmentOrderId: parcel.id ?? undefined,
          pickupLocationId: form.pickupLocationId,
          weightGrams: parsed.weightGrams,
          dimensionsCm: parsed.dimensionsCm,
          paymentMode: parsed.paymentMode,
          codAmountPaise: parsed.codAmountPaise,
        })
        setBooked({
          shipmentId: s.id,
          courier: chosen?.providerLabel ?? s.provider,
          waybill: s.waybill,
          labelUrl: s.labelUrl,
          trackingUrl: s.trackingUrl,
          manual: false,
          canPickup: draft?.couriers.find((c) => c.id === pick)?.hasPickup ?? false,
        })
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  const order = draft?.orders[0]
  const parcel = order?.parcels.find((p) => p.id === parcelId) ?? order?.parcels[0]
  if (failed || (draft && (!order || order.blocked || !parcel || !form))) {
    return (
      <ProoflyDetailPage
        header={
          <PageHeader
            title={content.page.title}
            back={{ label: content.page.backToOrder, href: routes.orders.detail(orderId) }}
          />
        }
        main={
          <DataCard title={content.page.title}>
            <EmptyState
              variant="plain"
              body={
                order?.blocked ? content.bulkPackage.blocked[order.blocked] : content.page.notFound
              }
            />
          </DataCard>
        }
      />
    )
  }
  if (!draft || !order || !parcel || !form) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-body text-muted-foreground">
        <Spinner />
        {content.loading}
      </div>
    )
  }

  // Render logic
  const parsed = parsePackage(form)
  const page = content.page
  const chosen = quote?.options.find((o) => o.providerId === pick) ?? null
  const place = draft.pickupPlaces.find((p) => p.id === form.pickupLocationId)
  const units = parcel.lines.reduce((n, l) => n + l.quantity, 0)
  const manual = pick === MANUAL
  const route = page.routeValue(place?.city ?? place?.name ?? '—', order.city ?? '—')
  const canBook = parsed !== null && (manual || (chosen !== null && !chosen.problem))
  const paymentLine = order.paymentMode === 'cod' ? page.cod : null

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={page.title}
          subtitle={page.subtitle(
            order.orderNumber,
            order.customerName ?? '',
            content.package.itemCount(units),
            paymentLine ?? '',
          )}
          back={{ label: page.back(order.orderNumber), href: routes.orders.detail(orderId) }}
          lead={{ kind: 'icon', node: <Truck aria-hidden="true" /> }}
          size="sm"
          badges={
            <>
              <OrderChip kind="orderPayment" value={order.paymentStatus} />
              <OrderChip kind="fulfilment" value={order.fulfillmentStatus} />
            </>
          }
          actions={
            booked ? null : (
              <Button variant="outline" onClick={handleShipYourself}>
                <PackageOpen aria-hidden="true" />
                {content.courier.manual}
              </Button>
            )
          }
        />
      }
      main={
        <>
          <RouteCard from={place} order={order} />
          <DataCard title={page.package}>
            <PackageStep
              draft={draft}
              order={order}
              parcel={parcel}
              form={form}
              onChange={setForm}
              onParcelChange={handleParcel}
            />
          </DataCard>
          <DataCard
            id="choose-courier"
            title={content.courier.heading}
            subtitle={draft.couriers.length > 0 ? content.courier.help : content.courier.noCourier}
          >
            <CourierStep
              inCard
              quote={quote}
              hasCouriers={draft.couriers.length > 0}
              pick={pick}
              onPick={setPick}
              tracking={tracking}
              onTrackingChange={setTracking}
              onRetry={() => setRetry((n) => n + 1)}
            />
          </DataCard>
        </>
      }
      side={
        booked ? (
          <DataCard title={booked.manual ? content.done.manualHeading : content.done.heading}>
            <DoneStep booked={booked} />
          </DataCard>
        ) : (
          <SummaryCard
            order={order}
            units={units}
            route={route}
            pkg={parsed}
            courier={manual ? null : chosen}
            manual={manual}
            canBook={canBook}
            busy={busy}
            onBook={handleBook}
          />
        )
      }
    />
  )
}
