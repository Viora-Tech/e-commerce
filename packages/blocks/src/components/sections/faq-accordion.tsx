'use client'

// Pattern after shadcnblocks' FAQ accordion (our own implementation). See THIRD_PARTY_NOTICES.md.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'

type FaqItem = { question: string; answer: string }

type FaqAccordionProps = {
  heading: string
  intro: string
  items: FaqItem[]
  multiOpen: boolean
}

export default function FaqAccordion({ heading, intro, items, multiOpen }: FaqAccordionProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())

  // Event handlers
  const handleToggle = (index: number) => {
    setOpenIds((current) => {
      const next = multiOpen ? new Set(current) : new Set<number>()
      if (current.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // Early returns
  if (items.length === 0) return null

  return (
    <div className="page-width grid grid-cols-1 gap-[2rem] md:grid-cols-[1fr_2fr]">
      <div>
        {heading ? <h2 className="h2 text-[var(--color-ink)]">{heading}</h2> : null}
        {intro ? <p className="text-body mt-[0.75rem] text-[var(--color-muted)]">{intro}</p> : null}
      </div>
      <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
        {items.map((item, i) => {
          const isOpen = openIds.has(i)
          const panelId = `faq-panel-${i}`
          const buttonId = `faq-button-${i}`
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            <div key={`${item.question}-${i}`}>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => handleToggle(i)}
                className="flex w-full items-center justify-between gap-[1rem] py-[1rem] text-left"
              >
                <span className="h5 text-[var(--color-ink)]">{item.question}</span>
                <span
                  aria-hidden
                  className="shrink-0 text-[var(--color-muted)] transition-transform duration-200"
                  style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
                >
                  +
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: reducedMotion ? 'auto' : 0, opacity: reducedMotion ? 1 : 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.25, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <p className="text-body pb-[1rem] text-[var(--color-muted)]">{item.answer}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
