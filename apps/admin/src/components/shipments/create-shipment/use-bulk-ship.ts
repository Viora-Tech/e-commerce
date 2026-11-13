'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { bulkShipContent } from '@/data/bulk-ship'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { repriced } from './bulk-edit-state'
import {
  type BookResult,
  type BulkRule,
  bulkBookRequest,
  bulkLines,
  missingPackage,
  type OrderEdit,
  orderQuoteRequest,
} from './bulk-ship-state'
import { courierTotals, type ParcelQuote, type ShipmentDraft, startingBulkPick } from './flow-state'

type Wallets = Awaited<ReturnType<typeof api.shipments.wallets>>

/**
 * The bulk ship drawer's data: the orders (`shipments.prepare`), every courier's answer for
 * each bookable order (`shipments.quote`, asked once, then again for one order after its Edit
 * popup changes its package or payment), the wallets, and booking (`shipments.bulkBook`).
 */
export function useBulkShip(orderIds: string[], courier: string | undefined) {
  // Hooks
  const copy = useCopy(bulkShipContent)
  const [draft, setDraft] = useState<ShipmentDraft | null>(null)
  const [failed, setFailed] = useState(false)
  const [quotes, setQuotes] = useState<Record<string, ParcelQuote>>({})
  const [asking, setAsking] = useState<ReadonlySet<string>>(new Set())
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [rule, setRule] = useState<BulkRule>('recommended')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, OrderEdit>>({})
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  /** The header switch; null until the draft says the store's default. */
  const [insuredAll, setInsuredAll] = useState<boolean | null>(null)
  const [wallets, setWallets] = useState<Wallets>([])
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<BookResult[] | null>(null)
  const [retry, setRetry] = useState(0)
  const key = orderIds.join(',')

  // A fresh batch each time the drawer opens for a new set of orders.
  useEffect(() => {
    if (!key) return
    let live = true
    setDraft(null)
    setFailed(false)
    setQuotes({})
    setEdits({})
    setUnticked(new Set())
    setInsuredAll(null)
    setResults(null)
    api.shipments
      .prepare({ orderIds: key.split(',') })
      .then((d) => live && setDraft(d))
      .catch(() => live && setFailed(true))
    api.shipments
      .wallets()
      .then((w) => live && setWallets(w))
      .catch(() => live && setWallets([]))
    return () => {
      live = false
    }
  }, [key])

  // Every bookable order's couriers, in one ask.
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once per batch (and on retry); edits re-ask one order
  useEffect(() => {
    if (!draft) return
    const requests = draft.orders.flatMap((o) => {
      const parcel = o.parcels.length === 1 ? o.parcels[0] : undefined
      if (o.blocked || !parcel || missingPackage(parcel, undefined)) return []
      return [orderQuoteRequest(o, parcel)]
    })
    if (requests.length === 0 || draft.couriers.length === 0) return
    let live = true
    setQuoteError(null)
    setAsking(new Set(requests.map((r) => r.orderId)))
    api.shipments
      .quote({ parcels: requests })
      .then((answer) => {
        if (!live) return
        setQuotes(Object.fromEntries(answer.map((q) => [q.orderId, q])))
        const start = startingBulkPick(courierTotals(answer, draft.couriers), courier)
        if (start.mode) setRule(start.mode)
        setProviderId(start.providerId)
      })
      .catch((err) => {
        if (live) setQuoteError(err instanceof Error && err.message ? err.message : '')
      })
      .finally(() => live && setAsking(new Set()))
    return () => {
      live = false
    }
  }, [draft, retry])

  // Helpers
  const askOne = async (orderId: string, edit: OrderEdit | undefined) => {
    const order = draft?.orders.find((o) => o.orderId === orderId)
    const parcel = order?.parcels.length === 1 ? order.parcels[0] : undefined
    if (!order || !parcel || missingPackage(parcel, edit)) return
    setAsking((s) => new Set([...s, orderId]))
    try {
      const [answer] = await api.shipments.quote({
        parcels: [orderQuoteRequest(order, parcel, edit)],
      })
      if (answer) setQuotes((q) => ({ ...q, [orderId]: answer }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setAsking((s) => new Set([...s].filter((id) => id !== orderId)))
    }
  }

  // Event handlers
  /** The Edit popup saved: a changed package or payment asks that order's couriers again. */
  const handleSaveEdit = (orderId: string, next: OrderEdit) => {
    const before = edits[orderId]
    setEdits((e) => ({ ...e, [orderId]: next }))
    if (repriced(before, next)) void askOne(orderId, next)
  }
  const handleTick = (orderId: string, on: boolean) =>
    setUnticked((s) => {
      const next = new Set(s)
      if (on) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  /** "Ask to pay online" on a COD row no courier takes: the shopper gets their payment link. */
  const handleAskPayOnline = async (orderId: string) => {
    setBusy(true)
    try {
      const { requestedAt, customerName } = await api.orders.requestOnlinePayment({ orderId })
      setDraft((d) =>
        d
          ? {
              ...d,
              orders: d.orders.map((o) =>
                o.orderId === orderId ? { ...o, payOnlineRequestedAt: requestedAt } : o,
              ),
            }
          : d,
      )
      toast.success(copy.payOnlineSent(customerName))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  const handleBook = async () => {
    const request = bulkBookRequest(lines, unticked, edits)
    if (request.orderIds.length === 0) return false
    setBusy(true)
    try {
      const booked = await api.shipments.bulkBook({ ...request, insured })
      const skipped = lines
        .filter((l) => !request.orderIds.includes(l.order.orderId))
        .map((l) => ({ orderId: l.order.orderId, ok: false }))
      setResults([...booked, ...skipped])
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const insured = insuredAll ?? draft?.insureByDefault ?? true
  const lines = draft
    ? bulkLines({ draft, quotes, asking, edits, rule, providerId, insuredAll: insured })
    : []

  return {
    draft,
    failed,
    lines,
    quotes,
    quoteError,
    recheck: () => setRetry((n) => n + 1),
    rule,
    setRule,
    providerId,
    setProviderId,
    edits,
    saveEdit: handleSaveEdit,
    unticked,
    tick: handleTick,
    setUnticked,
    insured,
    setInsured: setInsuredAll,
    wallets,
    busy,
    book: handleBook,
    askPayOnline: handleAskPayOnline,
    results,
  }
}
