'use client'

// Pattern after shadcnblocks' FAQ accordion (our own implementation). See THIRD_PARTY_NOTICES.md.
// Laid out as Figma Section / FAQ (708:120331): a centred title over one column of questions
// between hairlines, each with a plus that turns to a minus when open.
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { loadMotion } from '../../lazy-motion'
import { useReducedMotion } from '../../use-reduced-motion'
import Icon from '../icon'
import RichCopy from '../rich-copy'

/** Copy is a string in storage, a React node while edited on the canvas. */
type FaqItem = { question: ReactNode; answer: ReactNode }

type FaqAccordionProps = {
  heading: ReactNode
  intro: ReactNode
  items: FaqItem[]
  multiOpen: boolean
  /** On the Customize canvas every answer is open, so it can be clicked and edited. */
  editing?: boolean | undefined
}

type FaqPanelProps = {
  id: string
  labelledBy: string
  open: boolean
  answer: ReactNode
  /** Called once a closing panel has finished its exit, so the parent can unmount it. */
  onExited: () => void
}

const TRANSITION = { duration: 0.25, ease: 'easeOut' } as const

export default function FaqAccordion({
  heading,
  intro,
  items,
  multiOpen,
  editing = false,
}: FaqAccordionProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())
  // Panels still playing their exit: kept mounted until FaqPanel reports it is done.
  const [closingIds, setClosingIds] = useState<Set<number>>(new Set())

  // Event handlers
  const handleToggle = (index: number) => {
    const next = multiOpen ? new Set(openIds) : new Set<number>()
    if (openIds.has(index)) next.delete(index)
    else next.add(index)
    const closing = [...openIds].filter((i) => !next.has(i))
    if (!reducedMotion && closing.length > 0) {
      setClosingIds((current) => new Set([...current, ...closing]))
    }
    setOpenIds(next)
  }
  const handleExited = (index: number) => {
    setClosingIds((current) => {
      const next = new Set(current)
      next.delete(index)
      return next
    })
  }

  // Early returns
  if (items.length === 0) return null

  return (
    <div className="faq-accordion page-width">
      <div className="faq-accordion__head">
        {heading ? <h2 className="section-title">{heading}</h2> : null}
        <RichCopy value={intro} className="faq-accordion__intro" />
      </div>
      <div className="faq-accordion__list">
        {items.map((item, i) => {
          const isOpen = editing || openIds.has(i)
          const panelId = `faq-panel-${i}`
          const buttonId = `faq-button-${i}`
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            <div key={i}>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => handleToggle(i)}
                className="faq-accordion__question"
              >
                <span>{item.question}</span>
                <span aria-hidden className="faq-accordion__icon">
                  <Icon name={isOpen ? 'minus' : 'plus'} size={16} />
                </span>
              </button>
              {isOpen || closingIds.has(i) ? (
                <FaqPanel
                  id={panelId}
                  labelledBy={buttonId}
                  open={isOpen}
                  answer={item.answer}
                  onExited={() => handleExited(i)}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * One answer: grows from nothing when it opens and shrinks away when it closes
 * (height and opacity, 0.25 s ease-out). Motion is fetched on first use rather than
 * with the page; reduced motion (or a failed fetch) opens and shuts instantly.
 */
function FaqPanel({ id, labelledBy, open, answer, onExited }: FaqPanelProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  // The parent hands a fresh arrow every render; the animation must not restart for it.
  const exited = useRef(onExited)
  useEffect(() => {
    exited.current = onExited
  })
  useEffect(() => {
    const el = ref.current
    // A fresh panel grows from zero; one reopened mid-exit grows from where it is.
    const from = mounted.current ? el?.offsetHeight : 0
    mounted.current = true
    if (!el) return
    if (reducedMotion) {
      if (!open) exited.current()
      return
    }
    // Hold the starting pose until motion is in (it usually already is after one use).
    el.style.height = `${from}px`
    if (open && from === 0) el.style.opacity = '0'
    let live = true
    let run: { stop(): void } | undefined
    loadMotion()
      .then(({ animate }) => {
        if (!live) return
        const target = open ? el.scrollHeight : 0
        const animation = animate(
          el,
          { height: [from ?? 0, target], opacity: open ? 1 : 0 },
          TRANSITION,
        )
        run = animation
        return animation.then(() => {
          if (!live) return
          if (open) el.style.height = 'auto'
          else exited.current()
        })
      })
      .catch(() => {
        if (!live) return
        el.style.height = ''
        el.style.opacity = ''
        if (!open) exited.current()
      })
    return () => {
      live = false
      run?.stop()
    }
  }, [open, reducedMotion])

  return (
    // biome-ignore lint/a11y/useSemanticElements: the same div + role the Motion version rendered; a <section> would pick up the theme's section styles.
    <div id={id} role="region" aria-labelledby={labelledBy} ref={ref} className="overflow-hidden">
      <RichCopy value={answer} className="faq-accordion__answer" />
    </div>
  )
}
