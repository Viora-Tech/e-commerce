import type { ReactNode } from 'react'
import { asSlot } from '../../slot-types'
import ElementBox from './element-box'

export type AccordionProps = {
  /** `title` is a string in storage, a React node while edited on the canvas. */
  items: { title: ReactNode; open: boolean; content: unknown }[]
  allowMultiple: boolean
  style: unknown
}

/**
 * An accordion of native `<details>`: no JavaScript, keyboard and screen
 * reader support built in. With "let more than one stay open" off, the items
 * share a `name`, which modern browsers use to close the others.
 */
export default function AccordionBlock({ items, allowMultiple, style }: AccordionProps) {
  // Render logic
  const group = allowMultiple ? undefined : 'custom-accordion'

  return (
    <ElementBox look={style} className="custom-accordion w-full">
      <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
        {(items ?? []).map((item, i) => {
          const Content = asSlot(item?.content)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: items pair with their slot by position.
            <details key={i} name={group} open={item?.open === true} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                <span>{item?.title}</span>
                <span
                  aria-hidden
                  className="text-xl leading-none transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>
              <div className="pb-4">
                <Content className="flex flex-col gap-3" minEmptyHeight={64} />
              </div>
            </details>
          )
        })}
      </div>
    </ElementBox>
  )
}
