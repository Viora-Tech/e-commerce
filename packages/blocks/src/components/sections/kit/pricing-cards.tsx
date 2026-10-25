// The highlighted plan's moving border is adapted from Magic UI Border Beam (MIT), the shared
// effect `../../../effects/border-beam`. Layout is our own. See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import BorderBeam from '../../../effects/border-beam'
import type { Link } from '../../../sections/framed'
import { cx } from '../../../slot-types'
import Icon from '../../icon'
import KitButtons from './kit-buttons'
import KitHeading from './kit-heading'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Plan = {
  name: ReactNode
  price: ReactNode
  period: ReactNode
  /** One line per item; a node while it is being edited on the canvas. */
  features: ReactNode
  button: Link
  highlight: boolean
}

type PricingCardsProps = {
  heading: ReactNode
  text: ReactNode
  highlightLabel: ReactNode
  plans: Plan[]
}

/** The textarea's lines, or the node Puck hands over while it is being typed into. */
function lines(features: ReactNode): ReactNode[] {
  if (typeof features !== 'string') return features ? [features] : []
  return features
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/** Two to four plans or bundles side by side; one can be highlighted with a light on its border. */
export default function PricingCards({ heading, text, highlightLabel, plans }: PricingCardsProps) {
  // Early returns
  if (!plans?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col gap-[2.5rem]">
      <KitHeading heading={heading} text={text} />
      <div
        className={cx(
          'grid grid-cols-1 items-stretch gap-[1rem]',
          plans.length === 2 && 'md:grid-cols-2',
          plans.length >= 3 && 'md:grid-cols-3',
          plans.length >= 4 && 'lg:grid-cols-4',
        )}
      >
        {plans.map((plan, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            key={i}
            className={cx(
              'relative flex flex-col gap-[1.25rem] rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-[1.75rem] text-left',
              plan.highlight
                ? 'border-[var(--color-brand)] shadow-[0_1rem_3rem_-1.5rem_color-mix(in_oklab,var(--color-brand)_45%,transparent)]'
                : 'border-[var(--color-line)]',
            )}
          >
            {plan.highlight && highlightLabel ? (
              <span className="text-caption absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-brand)] px-[0.75rem] py-[0.25rem] text-[var(--color-on-brand)]">
                {highlightLabel}
              </span>
            ) : null}
            <div className="flex flex-col gap-[0.5rem]">
              <h3 className="h5 text-[var(--color-ink)]">{plan.name}</h3>
              <p className="flex flex-wrap items-baseline gap-x-[0.5rem]">
                <span className="h2 tabular-nums text-[var(--color-ink)]">{plan.price}</span>
                {plan.period ? (
                  <span className="text-small text-[var(--color-muted)]">{plan.period}</span>
                ) : null}
              </p>
            </div>
            <ul className="flex flex-1 flex-col gap-[0.625rem]">
              {lines(plan.features).map((line, n) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines of one textarea, in order.
                  key={n}
                  className="flex items-start gap-[0.625rem] text-small text-[var(--color-ink)]"
                >
                  <span className="mt-[0.125rem] shrink-0 text-[var(--color-brand)]">
                    <Icon name="check" size={14} />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {plan.highlight ? (
              <KitButtons primary={plan.button} className="[&>a]:w-full" />
            ) : (
              <KitButtons secondary={plan.button} className="[&>a]:w-full" />
            )}
            {plan.highlight ? <BorderBeam durationSeconds={9} /> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
