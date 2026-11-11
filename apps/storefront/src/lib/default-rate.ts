/** SOURCE OF TRUTH: which delivery card checkout ticks — WHAT: after each courier answer, keep the card the shopper picked while it is still offered, else tick the cheapest (ties keep the store's order) / WHY: with the Delivery options app a paid Express card listed first was ticked for shoppers (#1519), and a card ticked automatically stayed ticked after prices changed. */

type Rate = { id: string; pricePaise: number }

/** The cheapest card's id; the first of equals wins, so the store's order breaks ties. */
export function cheapestRateId(options: readonly Rate[]): string | null {
  let best: Rate | undefined
  for (const o of options) if (best === undefined || o.pricePaise < best.pricePaise) best = o
  return best?.id ?? null
}

/**
 * The card to tick after a new answer. `prev` is the ticked card; `shopperPicked` says the
 * shopper chose it (not checkout). Only the shopper's own pick survives a new answer.
 */
export function nextRateId(
  options: readonly Rate[],
  prev: string | null,
  shopperPicked: boolean,
): string | null {
  if (shopperPicked && prev !== null && options.some((o) => o.id === prev)) return prev
  return cheapestRateId(options)
}
