/** SOURCE OF TRUTH: routeOrder, ROUTING_RULES, MAX_ROUTING_LOCATIONS
 * WHAT:  Which warehouse(s) send an order, as parcels: pure, no database.
 * WHY:   A store with warehouses in several states (Waimers: Haryana, Delhi, Mumbai) ships each
 *        order from where the stock is, under that warehouse's GSTIN. The shopper always pays
 *        the same (prices include GST) and sees one order; only the parcels differ.
 *        ROUTING_RULES, in order (owner decisions 2026-10-10):
 *        1. Locations that may ship to the buyer: every location that ships online orders,
 *           except one billed under a composition GSTIN when the buyer is in another state
 *           (a composition taxpayer cannot supply goods inter-state). None left: refuse.
 *        2. One location with stock for every tracked line: the buyer's own state first, then
 *           the merchant's priority, then the most stock of the order's items, then the default.
 *        3. Else the fewest parcels up to the store's limit (`maxParcels`, default 2): the first
 *           set of locations, in that same preference order, whose stock together covers it.
 *        4. Else, when all selling locations together still hold enough, the home location
 *           (the default, else the first that may ship) takes what the others cannot cover, its
 *           reservation running past its stock, flagged `needsTransfer`: the merchant moves
 *           stock in. No sale is lost to a split.
 *        5. Not enough anywhere: a pre-order line goes to its own parcel at the home location,
 *           on hold, within its pre-order limit; any other line is out of stock.
 *        Untracked goods hold no stock and ride with the first parcel.
 * WHERE: routing-service.ts loads the locations and reserves what this returns; placeOrder
 *        and convertDraft call it.
 */

/** Only this many locations, in preference order, are tried in combinations (keeps it fast). */
export const MAX_ROUTING_LOCATIONS = 8

export type RoutingLine = {
  /** The caller's key for the line (its index or id), echoed back on the parcels. */
  key: string
  variantId: string
  quantity: number
  /** False for made-to-order and digital goods: nothing is reserved. */
  tracked: boolean
  /** Pre-order is on for the line: it may be sold past stock (the limit is the caller's). */
  preorder: boolean
}

export type RoutingLocation = {
  id: string
  /** The state the warehouse is in (the buyer's own state ships first). */
  stateCode: string | null
  /** The state of the GSTIN it bills under; null without one (then `stateCode` is used). */
  gstStateCode: string | null
  priority: number
  isDefault: boolean
  /** Billed under a composition GSTIN: it can only ship within its own state. */
  composition: boolean
  /** Available (on hand less committed) per variant; missing means none. */
  available: ReadonlyMap<string, number>
}

export type RoutedParcel = {
  locationId: string
  status: 'open' | 'on_hold'
  needsTransfer: boolean
  lines: { key: string; quantity: number }[]
}

export type RoutingResult =
  | { kind: 'routed'; parcels: RoutedParcel[] }
  | { kind: 'out_of_stock'; variantId: string }
  | { kind: 'no_location' }

const availableAt = (l: RoutingLocation, variantId: string) =>
  Math.max(0, l.available.get(variantId) ?? 0)

/** Units of each variant the given lines need. */
function needsOf(lines: readonly RoutingLine[]): Map<string, number> {
  const needs = new Map<string, number>()
  for (const l of lines) needs.set(l.variantId, (needs.get(l.variantId) ?? 0) + l.quantity)
  return needs
}

const covers = (locations: readonly RoutingLocation[], needs: ReadonlyMap<string, number>) =>
  [...needs].every(
    ([variantId, need]) => locations.reduce((n, l) => n + availableAt(l, variantId), 0) >= need,
  )

/** Every k-sized subset of `items`, in lexicographic (preference) order. */
function* combinations<T>(items: readonly T[], k: number, start = 0): Generator<T[]> {
  if (k === 0) {
    yield []
    return
  }
  for (let i = start; i <= items.length - k; i++) {
    for (const rest of combinations(items, k - 1, i + 1)) yield [items[i] as T, ...rest]
  }
}

/**
 * Split `lines` over `locations` (in that order): a line goes whole to the first location
 * that can send all of it, else it is taken from each in turn. What none can cover goes to
 * `overflow` when given (the needs-transfer fallback). Returns parcels by location.
 */
function allocate(
  lines: readonly RoutingLine[],
  locations: readonly RoutingLocation[],
  overflow: RoutingLocation | null,
): { parcels: Map<string, RoutedParcel>; short: number } {
  const left = new Map(
    locations.map((l) => [l.id, new Map([...l.available].map(([v, n]) => [v, Math.max(0, n)]))]),
  )
  const parcels = new Map<string, RoutedParcel>()
  const add = (locationId: string, key: string, quantity: number, needsTransfer = false) => {
    if (quantity <= 0) return
    const parcel = parcels.get(locationId) ?? {
      locationId,
      status: 'open' as const,
      needsTransfer: false,
      lines: [],
    }
    const same = parcel.lines.find((x) => x.key === key)
    if (same) same.quantity += quantity
    else parcel.lines.push({ key, quantity })
    parcel.needsTransfer ||= needsTransfer
    parcels.set(locationId, parcel)
  }
  const take = (locationId: string, variantId: string, quantity: number) => {
    const stock = left.get(locationId)
    stock?.set(variantId, (stock.get(variantId) ?? 0) - quantity)
  }
  let short = 0
  for (const line of lines) {
    const whole = locations.find((l) => (left.get(l.id)?.get(line.variantId) ?? 0) >= line.quantity)
    if (whole) {
      take(whole.id, line.variantId, line.quantity)
      add(whole.id, line.key, line.quantity)
      continue
    }
    let remaining = line.quantity
    for (const l of locations) {
      const n = Math.min(remaining, left.get(l.id)?.get(line.variantId) ?? 0)
      if (n <= 0) continue
      take(l.id, line.variantId, n)
      add(l.id, line.key, n)
      remaining -= n
    }
    if (remaining > 0) {
      short += remaining
      if (overflow) add(overflow.id, line.key, remaining, true)
    }
  }
  return { parcels, short }
}

/** ROUTING_RULES as a pure function: see the header. */
export function routeOrder(input: {
  lines: readonly RoutingLine[]
  locations: readonly RoutingLocation[]
  /** The buyer's two-letter state; null when unknown (composition is then not judged). */
  buyerState: string | null
  maxParcels: number
}): RoutingResult {
  const goods = input.lines.filter((l) => l.quantity > 0)
  if (goods.length === 0) return { kind: 'routed', parcels: [] }
  const buyer = input.buyerState
  const eligible = input.locations.filter((l) => {
    const billedFrom = l.gstStateCode ?? l.stateCode
    return !(l.composition && buyer && billedFrom && billedFrom !== buyer)
  })
  if (eligible.length === 0) return { kind: 'no_location' }

  const tracked = goods.filter((l) => l.tracked)
  // "Most stock": everything the location holds of the order's items.
  const orderVariants = [...new Set(tracked.map((l) => l.variantId))]
  const orderStock = (l: RoutingLocation) =>
    orderVariants.reduce((n, variantId) => n + availableAt(l, variantId), 0)
  const preference = [...eligible].sort(
    (a, b) =>
      Number(b.stateCode === buyer && buyer !== null) -
        Number(a.stateCode === buyer && buyer !== null) ||
      a.priority - b.priority ||
      orderStock(b) - orderStock(a) ||
      Number(b.isDefault) - Number(a.isDefault) ||
      a.id.localeCompare(b.id),
  )
  const home = eligible.find((l) => l.isDefault) ?? (preference[0] as RoutingLocation)

  // Rule 5: what no amount of stock covers is a pre-order on hold, or out of stock.
  const totals = needsOf(tracked)
  const short = new Set(
    [...totals]
      .filter(([variantId, need]) => !covers(eligible, new Map([[variantId, need]])))
      .map(([variantId]) => variantId),
  )
  for (const variantId of short) {
    if (tracked.some((l) => l.variantId === variantId && !l.preorder)) {
      return { kind: 'out_of_stock', variantId }
    }
  }
  const onHold = tracked.filter((l) => short.has(l.variantId))
  const stocked = tracked.filter((l) => !short.has(l.variantId))
  const needs = needsOf(stocked)

  let parcels: RoutedParcel[] = []
  if (stocked.length > 0) {
    const maxParcels = Math.max(1, Math.floor(input.maxParcels))
    // Rule 2: one location.
    const single = preference.find((l) => covers([l], needs))
    if (single) {
      parcels = [...allocate(stocked, [single], null).parcels.values()]
    } else {
      // Rule 3: the fewest locations, in preference order.
      const tried = preference.slice(0, MAX_ROUTING_LOCATIONS)
      for (let k = 2; k <= maxParcels && parcels.length === 0; k++) {
        for (const set of combinations(tried, k)) {
          if (!covers(set, needs)) continue
          parcels = [...allocate(stocked, set, null).parcels.values()]
          break
        }
      }
      // Rule 4: the home location takes the rest, past its stock.
      if (parcels.length === 0) {
        const others = tried.filter((l) => l.id !== home.id)
        let best: { parcels: Map<string, RoutedParcel>; short: number } | null = null
        for (let k = 0; k <= Math.min(maxParcels - 1, others.length); k++) {
          for (const set of combinations(others, k)) {
            const ordered = [...set, home].sort(
              (a, b) => preference.indexOf(a) - preference.indexOf(b),
            )
            const tryIt = allocate(stocked, ordered, home)
            if (!best || tryIt.short < best.short) best = tryIt
          }
        }
        parcels = best ? [...best.parcels.values()] : []
      }
    }
  }

  // Untracked goods ride with the first parcel, or go from the most preferred location.
  const free = goods.filter((l) => !l.tracked)
  if (free.length > 0) {
    const first =
      parcels[0] ??
      ({
        locationId: (preference[0] as RoutingLocation).id,
        status: 'open',
        needsTransfer: false,
        lines: [],
      } satisfies RoutedParcel)
    if (parcels.length === 0) parcels.push(first)
    for (const l of free) first.lines.push({ key: l.key, quantity: l.quantity })
  }
  parcels.sort(
    (a, b) =>
      preference.findIndex((l) => l.id === a.locationId) -
      preference.findIndex((l) => l.id === b.locationId),
  )
  if (onHold.length > 0) {
    parcels.push({
      locationId: home.id,
      status: 'on_hold',
      needsTransfer: false,
      lines: onHold.map((l) => ({ key: l.key, quantity: l.quantity })),
    })
  }
  return { kind: 'routed', parcels }
}
