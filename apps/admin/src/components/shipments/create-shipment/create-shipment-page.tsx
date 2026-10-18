'use client'

import { PackageOpen, RefreshCw, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import CountBadge from '@/components/layout/count-badge'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import EditOrderContactDialog from '@/components/orders/edit-order-contact-dialog'
import OrderChip from '@/components/orders/order-chip'
import type { OrderDetail } from '@/components/orders/order-detail-types'
import {
  EMPTY_TRACKING,
  type TrackingDraft,
  trackingPayload,
} from '@/components/orders/tracking-fields'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { bookShipment } from './book-shipment'
import CourierStep from './courier-step'
import DoneStep, { type BookedShipment } from './done-step'
import {
  MANUAL,
  type PackageForm,
  packageFor,
  parsePackage,
  type ShipmentDraft,
} from './flow-state'
import PackageStep from './package-step'
import PickupCard from './pickup-card'
import { pickupReady, startingPickupPlan } from './pickup-plan'
import RouteCard from './route-card'
import ShipPageUnavailable from './ship-page-unavailable'
import SummaryCard from './summary-card'
import { useShipQuote } from './use-ship-quote'

type Wallets = Awaited<ReturnType<typeof api.shipments.wallets>>

type CreateShipmentPageProps = {
  orderId: string
  /** Back link override; the order page unless opened from Shipments. */
  back?: { label: string; href: string }
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/**
 * Figma "Orders · Create shipment" (616:16737): one page for one order. Route, package and
 * courier on the left with live rates as the package changes; the summary and Book on the
 * right; once booked, the label and the pickup request take the summary's place.
 */
export default function CreateShipmentPage({ orderId, back }: CreateShipmentPageProps) {
  // Hooks
  const content = useCopy(createShipmentContent)
  const fmt = useFormat()
  const router = useRouter()
  const [draft, setDraft] = useState<ShipmentDraft | null>(null)
  const [failed, setFailed] = useState(false)
  const [parcelId, setParcelId] = useState<string | null>(null)
  const [form, setForm] = useState<PackageForm | null>(null)
  const {
    quote,
    pick,
    setPick,
    recheck,
    needsPackage,
    failed: quoteFailed,
  } = useShipQuote(draft, parcelId, form)
  const [pickup, setPickup] = useState(() => startingPickupPlan())
  const [wallets, setWallets] = useState<Wallets>([])
  const [tracking, setTracking] = useState<TrackingDraft>(EMPTY_TRACKING)
  const [busy, setBusy] = useState(false)
  const [booked, setBooked] = useState<BookedShipment | null>(null)
  /* The full order, loaded when the merchant edits the delivery address from this page. */
  const [editing, setEditing] = useState<OrderDetail | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let live = true
    api.shipments
      .prepare({ orderIds: [orderId] })
      .then((d) => {
        if (!live) return
        setDraft(d)
        const first = d.orders[0]?.parcels[0]
        const o = d.orders[0]
        /* After an address edit only the draft refreshes; the package the merchant typed stays. */
        if (o && first && revision === 0) {
          setParcelId(first.id)
          setForm(packageFor(o, first, d))
        }
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [orderId, revision])

  useEffect(() => {
    api.shipments
      .wallets()
      .then(setWallets)
      .catch(() => setWallets([]))
  }, [])

  // Event handlers
  const handleParcel = (id: string) => {
    const o = draft?.orders[0]
    const next = o?.parcels.find((p) => p.id === id)
    if (!draft || !o || !next) return
    setParcelId(next.id)
    setForm(packageFor(o, next, draft))
  }
  const handlePickupPlace = (pickupLocationId: string | null) =>
    form && setForm({ ...form, pickupLocationId })
  const handleEditCustomer = async () => {
    try {
      const full = await api.orders.get({ id: orderId })
      if (full) setEditing(full)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }
  const handleCustomerSaved = () => {
    setEditing(null)
    setRevision((n) => n + 1)
    recheck()
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
      setBooked(
        await bookShipment({
          order,
          parcel,
          form,
          parsed,
          pick,
          courier: chosen,
          typed,
          courierLabel: chosen?.providerLabel,
          canPickup: draft?.couriers.find((c) => c.id === chosen?.providerId)?.hasPickup ?? false,
          pickup,
          pickupFailed: content.pickup.notSupported,
        }),
      )
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
    return <ShipPageUnavailable orderId={orderId} blocked={order?.blocked ?? null} />
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
  const chosen = quote?.options.find((o) => o.optionKey === pick) ?? null
  const place = draft.pickupPlaces.find((p) => p.id === form.pickupLocationId)
  const units = parcel.lines.reduce((n, l) => n + l.quantity, 0)
  const manual = pick === MANUAL
  const route = page.routeValue(place?.city ?? place?.name ?? '—', order.city ?? '—')
  const canPickup = draft.couriers.find((c) => c.id === chosen?.providerId)?.hasPickup ?? false
  const pickupOn = !manual && pickup.ask && canPickup
  const canBook =
    parsed !== null &&
    (manual || (chosen !== null && !chosen.problem)) &&
    (!pickupOn || pickupReady(pickup))
  const serviceable = quote?.options.some((o) => o.problem === null) ?? false
  const wallet = manual ? null : wallets.find((w) => w.provider === chosen?.providerId)
  const walletNote =
    wallet && (wallet.supportsLiveBalance || wallet.fetchedAt)
      ? page.walletLeft(wallet.providerLabel, fmt.money(wallet.balancePaise))
      : null
  const pickupLine = pickupOn
    ? page.pickupValue(fmt.pattern(pickup.date, SHORT_DATE), pickup.timeFrom)
    : null
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
          back={
            back ?? { label: page.back(order.orderNumber), href: routes.orders.detail(orderId) }
          }
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
          <RouteCard
            from={place}
            places={draft.pickupPlaces}
            order={order}
            serviceable={serviceable}
            onPickupChange={handlePickupPlace}
            onEditCustomer={() => void handleEditCustomer()}
          />
          {editing ? (
            <EditOrderContactDialog
              order={editing}
              open
              onClose={() => setEditing(null)}
              onSaved={handleCustomerSaved}
            />
          ) : null}
          <DataCard
            title={
              <span className="flex items-center gap-2">
                {page.package}
                <CountBadge n={content.package.itemCount(units)} tone="outline" />
              </span>
            }
          >
            <PackageStep
              draft={draft}
              order={order}
              parcel={parcel}
              form={form}
              onChange={setForm}
              onParcelChange={handleParcel}
              inCard
              chargedGrams={quote?.chargedWeightGrams}
            />
          </DataCard>
          <DataCard
            id="choose-courier"
            title={content.courier.heading}
            subtitle={draft.couriers.length > 0 ? content.courier.help : content.courier.noCourier}
            action={
              draft.couriers.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={recheck}>
                  <RefreshCw aria-hidden="true" />
                  {content.courier.retry}
                </Button>
              ) : null
            }
          >
            <CourierStep
              inCard
              quote={quote}
              hasCouriers={draft.couriers.length > 0}
              pick={pick}
              onPick={setPick}
              tracking={tracking}
              onTrackingChange={setTracking}
              onRetry={recheck}
              needsPackage={needsPackage}
              failed={quoteFailed}
            />
          </DataCard>
          {manual ? null : <PickupCard plan={pickup} onChange={setPickup} canPickup={canPickup} />}
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
            chargedGrams={quote?.chargedWeightGrams}
            pickupLine={pickupLine}
            walletNote={walletNote}
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
