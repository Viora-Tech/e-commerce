// Cards adapted from Magic UI Magic Card (MIT), the shared effect `../../../effects/magic-card`.
// Layout is our own. See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import MagicCard from '../../../effects/magic-card'
import Icon, { isIconName } from '../../icon'
import KitHeading from './kit-heading'

/** Copy is a string in storage, a React node while edited on the canvas (icons stay strings). */
type FeatureCardsProps = {
  heading: ReactNode
  text: ReactNode
  columns: 2 | 3
  items: { icon: string; title: ReactNode; text: ReactNode }[]
}

const COLUMNS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' } as const

/** Benefits in a grid of cards, each with an icon; the border lights up under the mouse. */
export default function FeatureCards({ heading, text, columns, items }: FeatureCardsProps) {
  // Early returns
  if (!items?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col gap-[2.5rem]">
      <KitHeading heading={heading} text={text} />
      <div className={`grid grid-cols-1 gap-[1rem] ${COLUMNS[columns] ?? COLUMNS[3]}`}>
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <MagicCard key={i} className="h-full">
            <div className="flex h-full flex-col gap-[0.75rem] p-[1.5rem] text-left">
              {isIconName(item.icon) ? (
                <span className="flex size-[2.75rem] items-center justify-center rounded-[0.75rem] bg-[color-mix(in_oklab,var(--color-brand)_12%,transparent)] text-[var(--color-brand)]">
                  <Icon name={item.icon} size={22} />
                </span>
              ) : null}
              {item.title ? <h3 className="h5 text-[var(--color-ink)]">{item.title}</h3> : null}
              {item.text ? (
                <p className="text-small text-[var(--color-muted)]">{item.text}</p>
              ) : null}
            </div>
          </MagicCard>
        ))}
      </div>
    </div>
  )
}
