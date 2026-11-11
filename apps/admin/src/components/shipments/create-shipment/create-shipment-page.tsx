'use client'

import { CalendarIcon, PackageOpen, RefreshCw, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import AppStoreLink from '@/components/apps/app-store-link'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import CountBadge from '@/components/layout/count-badge'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import EditOrderContactDialog from '@/components/orders/edit-order-contact-dialog'
import OrderChip from '@/components/orders/order-chip'
import type { OrderDetail } from '@/components/orders/order-detail-types'
import TrackingFields, {
  EMPTY_TRACKING,
  type TrackingDraft,
  trackingPayload,
} from '@/components/orders/tracking-fields'
import { createShipmentContent } from '@/data/create-shipment'
import { shipmentDetailsContent } from '@/data/shipping'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ShipmentDetailsLoader from '../shipment-details-loader'
import { bookShipment } from './book-shipment'
import CourierDrawer from './courier-drawer'
import DoneStep, { type BookedShipment } from './done-step'
import {
  MANUAL,
  type PackageForm,
  packageFor,
  parsePackage,
  type ShipmentDraft,
} from './flow-state'
import NoPickupLocationAlert, { missingPickupLocation } from './no-pickup-location-alert'
import PackageStep from './package-step'
import PartialPicker from './partial-picker'
import PickupNowDialog from './pickup-now-dialog'
import { startingPickupPlan } from './pickup-plan'
import RouteCard from './route-card'
import ShipPageUnavailable from './ship-page-unavailable'
import SummaryCard from './summary-card'
import { useShipQuote } from './use-ship-quote'

type Wallets = Awaited<ReturnType<typeof api.shipments.wallets>>

type CreateShipmentPageProps = {
  orderId: string
  /** Back link override; the order page unless opened from Shipments. */
  back?: { label: string; href: string }
  /** A courier's provider id to start on (a courier app's "Create shipment" order action). */
  courier?: string | undefined
}

/**
 * Figma "Orders · Create shipment" (616:16737): one page for one order. Route, package and
 * courier on the left with live rates as the package changes; the summary and Book on the
 * right; once booked, the label and the pickup request take the summary's place.
 */
export default function CreateShipmentPage({ orderId, back, courier }: CreateShipmentPageProps) {
  // Hooks
  const content = useCopy(createShipmentContent)
  const detailsCopy = useCopy(shipmentDetailsContent)
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
    updating,
    waitingForSize,
  } = useShipQuote(draft, parcelId, form, courier)
  const [pickup] = useState(() => startingPickupPlan())
  const [wallets, setWallets] = useState<Wallets>([])
  const [tracking, setTracking] = useState<TrackingDraft>(EMPTY_TRACKING)
  const [busy, setBusy] = useState(false)
  /** The Select courier drawer (Figma 898:7790). */
  const [drawer, setDrawer] = useState(false)
  /** The merchant chose the courier in the drawer; until then Book shipment opens it. */
  const [chosenByHand, setChosenByHand] = useState(false)
  /** Shipping insurance (the drawer's toggle); null follows what the shopper chose at checkout. */
  const [insuredChoice, setInsuredChoice] = useState<boolean | null>(null)
  /** The courier whose Ship now is booking. */
  const [shipping, setShipping] = useState<string | null>(null)
  /** Create pickup now, after booking. */
  const [pickupOpen, setPickupOpen] = useState(false)
  /** Ship it yourself: the connected app the AWB was booked in, from its own panel. */
  const [panel, setPanel] = useState<string | null>(null)
  const [booked, setBooked] = useState<BookedShipment | null>(null)
  /* Delhivery refused the booking: no pickup location by the name sent (shown with the name). */
  const [missingPlace, setMissingPlace] = useState<string | null>(null)
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
  /* After a partial split the parcel holds fewer items: reload it and its package. */
  const handleSplit = async () => {
    try {
      const d = await api.shipments.prepare({ orderIds: [orderId] })
      setDraft(d)
      const o = d.orders[0]
      const same = o?.parcels.find((p) => p.id === parcelId) ?? o?.parcels[0]
      if (o && same) {
        setParcelId(same.id)
        setForm(packageFor(o, same, d))
      }
      recheck()
    } catch {
      setFailed(true)
    }
  }
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
    setDrawer(true)
  }
  const handleShipNow = (optionKey: string) => {
    setPick(optionKey)
    void handleBook(optionKey)
  }
  const handleBook = async (optionKey?: string) => {
    if (!order || !parcel || !form || !parsed) return
    const key = optionKey ?? pick
    const chosen = quote?.options.find((o) => o.optionKey === key) ?? null
    /* Booking always goes through the courier list (Figma 898:7790): Book shipment opens it
       until the merchant picks a courier there, and Ship now books from it. */
    if (
      key !== MANUAL &&
      (!chosen || chosen.problem || !pricesCurrent || (!optionKey && !chosenByHand))
    ) {
      setDrawer(true)
      return
    }
    const typed = trackingPayload(tracking)
    if (key === MANUAL && (!typed.trackingNumber || !typed.courier)) {
      toast.error(content.courier.manualMissing)
      return
    }
    if (chosen?.needsTrackingNumber && !typed.trackingNumber) {
      toast.error(content.courier.counterNumber.help)
      return
    }
    setBusy(true)
    setShipping(optionKey ?? null)
    setMissingPlace(null)
    try {
      setBooked(
        await bookShipment({
          order,
          parcel,
          form,
          parsed,
          pick: key,
          courier: chosen,
          typed,
          panelProviderId: key === MANUAL ? panel : null,
          insured: key === MANUAL ? undefined : insured,
          courierLabel: chosen?.providerLabel,
          canPickup: draft?.couriers.find((c) => c.id === chosen?.providerId)?.hasPickup ?? false,
          // Booking only books (owner, 10 Nov 2026): the pickup is made on Shipments › Booked.
          pickup: { ...pickup, ask: false },
          pickupFailed: content.pickup.notSupported,
        }),
      )
      setDrawer(false)
      router.refresh()
    } catch (err) {
      const place = missingPickupLocation(err)
      if (place !== null) {
        setMissingPlace(place)
        setDrawer(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      setShipping(null)
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
  /* A courier's price is only booked once it answers the package on screen. */
  const pricesCurrent = manual || (!updating && !waitingForSize)
  const canBook =
    parsed !== null && pricesCurrent && (manual || (chosen !== null && !chosen.problem))
  const serviceable = quote?.options.some((o) => o.problem === null) ?? false
  const wallet = manual ? null : wallets.find((w) => w.provider === chosen?.providerId)
  const walletNote =
    wallet && (wallet.supportsLiveBalance || wallet.fetchedAt)
      ? page.walletLeft(wallet.providerLabel, fmt.money(wallet.balancePaise))
      : null
  const paymentLine = order.paymentMode === 'cod' ? page.cod : null
  const insured = insuredChoice ?? quote?.checkout?.insured === true
  const charged = quote?.chargedWeightGrams
    ? `${fmt.number(Math.round(quote.chargedWeightGrams / 10) / 100)} kg`
    : ''
  const box = parsed?.dimensionsCm
    ? ` (${parsed.dimensionsCm.length} × ${parsed.dimensionsCm.width} × ${parsed.dimensionsCm.height} cm)`
    : ''
  const drawerSummary = content.drawer.summary(
    `#${order.orderNumber} · ${route}`,
    charged ? `${charged}${box}` : '',
    `${order.paymentMode === 'cod' ? page.codShort : page.prepaidShort} ${fmt.money(parcel.valuePaise)}`,
  )
  const drawerStatus = !quote ? (
    draft.couriers.length === 0 ? (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-body text-muted-foreground">{content.courier.noCourier}</p>
        <AppStoreLink category="shipping" className="w-fit">
          {content.courier.connect}
        </AppStoreLink>
      </div>
    ) : needsPackage ? (
      <p className="py-6 text-body text-muted-foreground">{content.courier.needsWeight}</p>
    ) : quoteFailed ? (
      <p className="flex items-center gap-3 py-6 text-body text-muted-foreground">
        {content.courier.quoteFailed}
        <Button size="sm" variant="outline" onClick={recheck}>
          <RefreshCw aria-hidden />
          {content.courier.retry}
        </Button>
      </p>
    ) : (
      <p className="flex items-center gap-2 py-6 text-body text-muted-foreground">
        <Spinner />
        {content.courier.checking}
      </p>
    )
  ) : updating || waitingForSize ? (
    <p aria-live="polite" className="flex items-center gap-2 text-caption text-muted-foreground">
      {updating ? <Spinner className="size-3.5" /> : null}
      {updating ? content.courier.updating : content.courier.finishSize}
    </p>
  ) : null

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
        booked ? (
          /* Booked: the editing cards give way to the shipment as it now stands, read-only. */
          <DataCard title={detailsCopy.heading}>
            {booked.shipmentId ? (
              <ShipmentDetailsLoader
                shipmentId={booked.shipmentId}
                onChanged={() => router.refresh()}
              />
            ) : (
              <DoneStep booked={booked} />
            )}
          </DataCard>
        ) : (
          <>
            {missingPlace !== null ? <NoPickupLocationAlert name={missingPlace} /> : null}
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
              <PartialPicker
                key={`${parcel.id ?? 'whole'}:${parcel.lines.map((l) => `${l.id}x${l.quantity}`).join(',')}`}
                orderId={orderId}
                parcelId={parcel.id}
                lines={parcel.lines}
                onSplit={handleSplit}
              />
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
            <CourierDrawer
              open={drawer}
              onOpenChange={setDrawer}
              summary={drawerSummary}
              rows={quote?.options ?? null}
              pick={pick}
              onPick={(key) => {
                setPick(key)
                setChosenByHand(true)
              }}
              onShipNow={pricesCurrent ? handleShipNow : undefined}
              shippingKey={shipping}
              insured={insured}
              onInsured={setInsuredChoice}
              valueLabel={fmt.money(parcel.valuePaise)}
              onRetry={draft.couriers.length > 0 ? recheck : undefined}
              status={drawerStatus}
              chargedGrams={quote?.chargedWeightGrams}
            >
              {manual ? (
                <div className="flex flex-col gap-3 rounded-lg border border-primary bg-primary-soft p-4">
                  <p className="font-medium text-ink-strong">{content.courier.manual}</p>
                  {draft.couriers.length > 0 ? (
                    <ChoiceField
                      id="panel-courier"
                      label={content.courier.panelLabel}
                      value={panel ?? ''}
                      options={[
                        { value: '', label: content.courier.panelNone },
                        ...draft.couriers.map((c) => ({ value: c.id, label: c.label })),
                      ]}
                      onChange={(v) => setPanel(v || null)}
                    />
                  ) : null}
                  <TrackingFields value={tracking} onChange={setTracking} />
                  <Button className="self-end" loading={busy} onClick={() => void handleBook()}>
                    {content.review.saveManual}
                  </Button>
                </div>
              ) : null}
            </CourierDrawer>
          </>
        )
      }
      side={
        booked ? (
          <DataCard title={booked.manual ? content.done.manualHeading : content.done.heading}>
            <DoneStep booked={booked} summaryOnly />
            {booked.shipmentId && !booked.manual ? (
              <>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => setPickupOpen(true)}
                >
                  <CalendarIcon aria-hidden="true" />
                  {content.drawer.pickupNow}
                </Button>
                <PickupNowDialog
                  open={pickupOpen}
                  onOpenChange={setPickupOpen}
                  shipmentIds={[booked.shipmentId]}
                  onDone={() => router.refresh()}
                />
              </>
            ) : null}
          </DataCard>
        ) : (
          <SummaryCard
            order={order}
            units={units}
            route={route}
            pkg={parsed}
            courier={manual ? null : chosen}
            chargedGrams={quote?.chargedWeightGrams}
            pickupLine={null}
            walletNote={walletNote}
            manual={manual}
            canBook={canBook}
            busy={busy}
            onBook={() => void handleBook()}
            onSelectCourier={() => setDrawer(true)}
          />
        )
      }
    />
  )
}
