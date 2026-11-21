/** SOURCE OF TRUTH: a courier picked per parcel — WHAT: the snapshot key of a choice
 * (`choiceKey`), each parcel's own shown prices (`parcelShownPrices`) and what a per-parcel
 * choice charges (`parcelChoice`: every parcel's pick at the lower of now and what its card
 * showed, added up) / WHY: a cart split by product rules has no courier every parcel offers, so
 * the shopper picks one per parcel (owner, 21 Nov 2026), and the consistency rule holds per
 * parcel: the order never charges a parcel more than its card showed. Pure.
 */
import { sumParcelRoutes } from './parcels'
import { chosenRoute } from './resolve'
import type { PricedRoute, ResolvedOption } from './resolve-types'

export const choiceKey = (
  optionId: string,
  routeKey: string | null,
  insured: boolean,
  payment: 'prepaid' | 'cod',
): string => `${optionId}|${routeKey ?? ''}|${insured ? 'i' : '-'}|${payment}`

/** The separate COD charge of a choice: a list card's own, else the option's COD pick's. */
export function codFeeOf(o: ResolvedOption, routeKey: string | null): number | null {
  if (o.layout === 'list') {
    const card = (routeKey && o.choices.find((c) => c.route.key === routeKey)) || o.choices[0]
    if (card) return card.codFeePaise ?? null
  }
  return o.cod?.codFeePaise ?? null
}

/** Parcel `i`'s key for a choice: the option's key with `|p<i>` after it. */
const parcelKey = (key: string, i: number) => `${key}|p${i}`

/** Every price each parcel's own card shows, under the option's tick (`insured`). */
export function parcelShownPrices(o: ResolvedOption, out: Record<string, number>): void {
  const insured = o.insurance.on
  o.parcelOptions?.forEach((part, i) => {
    out[parcelKey(choiceKey(o.optionId, null, insured, 'prepaid'), i)] = part.pricePaise
    for (const c of part.choices)
      out[parcelKey(choiceKey(o.optionId, c.route.key, insured, 'prepaid'), i)] = c.pricePaise
    if (!o.codAllowed) return
    const cod = chosenRoute(part, null, 'cod')
    if (cod) out[parcelKey(choiceKey(o.optionId, null, insured, 'cod'), i)] = cod.pricePaise
    if (part.layout === 'list')
      for (const c of part.choices)
        if (c.codPricePaise != null)
          out[parcelKey(choiceKey(o.optionId, c.route.key, insured, 'cod'), i)] = c.codPricePaise
    const fee = codFeeOf(part, null)
    if (fee != null) out[`${parcelKey(choiceKey(o.optionId, null, insured, 'cod'), i)}|fee`] = fee
    if (part.layout === 'list')
      for (const c of part.choices)
        if (c.codFeePaise != null)
          out[`${parcelKey(choiceKey(o.optionId, c.route.key, insured, 'cod'), i)}|fee`] =
            c.codFeePaise
  })
}

const atMost = (now: number, shown: number | undefined) =>
  shown === undefined ? now : Math.min(now, shown)

export type ParcelChoice = {
  /** Every parcel's pick, at what it is charged, in parcel order. */
  routes: PricedRoute[]
  /** Them added up: the order's shipping and route. */
  total: PricedRoute
  /** The courier COD charges on their own line, added up; null: none. */
  codFeePaise: number | null
  /** The shopper picked another courier than the card's own on some parcel. */
  shopperPicked: boolean
}

/**
 * What a per-parcel choice charges: each parcel's courier (`routeKeys[i]`, null or missing: the
 * parcel's own pick) at the lower of now and its card's shown price. Null when the option has
 * no per-parcel cards or a parcel has no route.
 */
export function parcelChoice(
  option: ResolvedOption,
  routeKeys: readonly (string | null)[],
  payment: 'prepaid' | 'cod',
  shown: Record<string, number> | null,
): ParcelChoice | null {
  const parts = option.parcelOptions
  if (!parts?.length) return null
  let fees: number | null = null
  let shopperPicked = false
  const routes: PricedRoute[] = []
  for (const [i, part] of parts.entries()) {
    const key = routeKeys[i] ?? null
    const priced = chosenRoute(part, key, payment)
    if (!priced) return null
    if (key && priced.route.key !== part.pick?.route.key) shopperPicked = true
    const shownKey = parcelKey(
      choiceKey(
        option.optionId,
        payment === 'cod' && part.layout !== 'list' ? null : key,
        option.insurance.on,
        payment,
      ),
      i,
    )
    const price = atMost(priced.pricePaise, shown?.[shownKey])
    routes.push({
      ...priced,
      pricePaise: price,
      listPricePaise: Math.max(price, priced.listPricePaise),
    })
    const fee = payment === 'cod' ? codFeeOf(part, key) : null
    if (fee !== null) fees = (fees ?? 0) + atMost(fee, shown?.[`${shownKey}|fee`])
  }
  const total = sumParcelRoutes(routes)
  return total ? { routes, total, codFeePaise: fees, shopperPicked } : null
}
