/** SOURCE OF TRUTH: the "Shoppers will see" example in the Product rule dialog
 * WHAT:  A small courier list for the rule being edited, priced the engine's way (the included
 *        courier at the rule's price, a cheaper one at the same price, a dearer one plus the
 *        difference rounded up to …9) from made-up courier costs, so no route has to be asked.
 * WHY:   Owner, 20 Nov 2026: ticking "Delhivery Air" read as "mice ship free". The example puts
 *        a price next to every courier ("Delhivery Air · Free · Recommended", "Blue Dart Air ·
 *        + ₹49"). Labelled as an example; Try a PIN shows the real prices.
 * WHERE: rule-preview-line.tsx. Pure.
 */
import { roundPrice } from '@commerce/core/delivery-options'
import { parseRupees } from '@commerce/money'
import { type RuleDraft, splitChip } from './rule-draft'

export type SampleCard = {
  id: string
  carrier: string
  speed: 'standard' | 'express'
  pricePaise: number
  /** What it costs over the included courier; 0 for that one and cheaper ones. */
  extraPaise: number
  recommended: boolean
}

/** Made-up courier costs: Surface from ₹52, Air from ₹86, a little more per courier. */
export function exampleCost(index: number, speed: 'standard' | 'express'): number {
  return (speed === 'express' ? 8600 : 5200) + index * 900
}

/** The example cards, the included courier first; empty with no chip ticked. */
export function sampleCards(d: RuleDraft): SampleCard[] {
  const carriers = [...new Set(d.chips.map((c) => splitChip(c).carrier))]
  const priced = d.chips.flatMap((id) => {
    const { carrier, speed } = splitChip(id)
    if (speed === 'any') return []
    return [{ id, carrier, speed, cost: exampleCost(carriers.indexOf(carrier), speed) }]
  })
  if (priced.length === 0) return []
  const byCost = [...priced].sort((a, b) => a.cost - b.cost)
  const want = d.preferred ? splitChip(d.preferred) : null
  const first =
    (want &&
      byCost.find((c) => c.carrier === want.carrier && (want.speed === 'any' || c.speed === want.speed))) ||
    byCost[0]
  if (!first) return []
  const normal = roundPrice(first.cost, 'nine')
  const base =
    d.priceMode === 'free'
      ? 0
      : d.priceMode === 'fixed'
        ? (parseRupees(d.fixed) ?? normal)
        : normal
  const card = (c: (typeof priced)[number]): SampleCard => {
    const extra = roundPrice(Math.max(0, c.cost - first.cost), 'nine')
    return {
      id: c.id,
      carrier: c.carrier,
      speed: c.speed,
      pricePaise: base + extra,
      extraPaise: extra,
      recommended: c === first,
    }
  }
  if (d.forceRoute && want) return [card(first)]
  const rest = byCost.filter(
    // The included courier hides its own other speed, as checkout does.
    (c) => c !== first && !(want && c.carrier === first.carrier),
  )
  return [card(first), ...rest.map(card)]
}
