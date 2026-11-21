'use client'

import {
  type DeliveryOption,
  PRICE_ROUNDINGS,
  type PriceRounding,
} from '@commerce/core/delivery-options'
import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { type FasterAnswer, fasterAmounts, type WhoPays } from './option-answers'
import OptionExampleLine from './option-example-line'
import RuleStep from './rule-step'
import TickCards from './tick-cards'

type DeliveryQuestionsProps = {
  /** Prefix for ids and radio names: one set of questions per page. */
  idPrefix: string
  /** The option as it would price now, for the example line and the card amounts; null while
   *  a field cannot be read. */
  example: Pick<DeliveryOption, 'name' | 'price' | 'couriers' | 'speed' | 'strategy'> | null
  whoPays: WhoPays
  onWhoPays: (next: WhoPays) => void
  /** Question 2 shows only when shoppers can be offered more than one courier. */
  askFaster: boolean
  faster: FasterAnswer | null
  onFaster: (next: FasterAnswer) => void
  rounding: PriceRounding
  onRounding: (next: PriceRounding) => void
}

const WHO_PAYS: readonly WhoPays[] = ['route', 'zone', 'free']
const FASTER: readonly FasterAnswer[] = ['no', 'difference', 'full']

/**
 * The 3 questions the owner chose (21 Nov 2026): "Who pays for delivery?" (`price.source`),
 * "Can shoppers pick a faster courier?" (one courier, + the extra, or its full price, with the
 * made-up example amounts) and "Round prices to", with the live "At checkout, for example"
 * line under the last.
 */
export default function DeliveryQuestions({
  idPrefix,
  example,
  whoPays,
  onWhoPays,
  askFaster,
  faster,
  onFaster,
  rounding,
  onRounding,
}: DeliveryQuestionsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionQuestionsContent)
  const fmt = useFormat()

  // Helpers
  const money = (p: number | null) => (p === null ? null : fmt.money(p))

  // Render logic
  const amounts = example ? fasterAmounts(example) : { extraPaise: null, fullPaise: null }
  const fasterAmount: Record<FasterAnswer, string | null> = {
    no: null,
    difference: money(amounts.extraPaise),
    full: money(amounts.fullPaise),
  }
  const roundStep = askFaster ? 3 : 2
  const ids = {
    who: `${idPrefix}-q-who`,
    faster: `${idPrefix}-q-faster`,
    round: `${idPrefix}-q-round`,
  }

  return (
    <div className="flex flex-col gap-5">
      <RuleStep step={1} id={ids.who} title={copy.whoPays.title}>
        <TickCards
          name={ids.who}
          labelledBy={ids.who}
          value={whoPays}
          items={WHO_PAYS.map((v) => ({ value: v, ...copy.whoPays.items[v] }))}
          onChange={onWhoPays}
        />
      </RuleStep>
      {askFaster ? (
        <RuleStep step={2} id={ids.faster} title={copy.faster.title}>
          <TickCards
            name={ids.faster}
            labelledBy={ids.faster}
            value={faster}
            items={FASTER.map((v) => ({
              value: v,
              label: copy.faster.items[v].label(fasterAmount[v]),
              help: copy.faster.items[v].help,
            }))}
            onChange={onFaster}
          />
          {faster === null ? (
            <p className="text-caption text-muted-foreground">{copy.faster.sameNote}</p>
          ) : null}
        </RuleStep>
      ) : null}
      <RuleStep step={roundStep} id={ids.round} title={copy.round.title}>
        <TickCards
          name={ids.round}
          labelledBy={ids.round}
          value={rounding}
          items={PRICE_ROUNDINGS.map((v) => ({ value: v, ...copy.round.items[v] }))}
          onChange={onRounding}
        />
        {example ? <OptionExampleLine option={example} /> : null}
      </RuleStep>
    </div>
  )
}
