'use client'

import { SECTION_SOURCES } from '@commerce/blocks/puck'
import { Drawer } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { type FocusEvent, type KeyboardEvent, type MouseEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { customizeContent } from '@/data/customize'
import SectionIcon from './section-icon'
import SectionLivePreview from './section-live-preview'

type SectionCardProps = {
  type: string
  label: string
  description: string
  /** Set for an app-contributed block, shown as a small badge over the glyph. */
  appIcon?: string | undefined
  hovered: boolean
  onHover: (type: string | null) => void
  onAdd: () => void
}

type Anchor = { top: number; left: number }

const copy = customizeContent.addSection

/** Room kept between the hover preview and the viewport's edges. */
const EDGE = 12
/** The preview card's rough height, to keep it on screen near the bottom of a list. */
const PREVIEW_HEIGHT = 240

/**
 * Where the hover preview goes: level with the card, just outside the panel or
 * popover the card sits in. Both clip their overflow, which is why the
 * preview is portalled out to the page rather than positioned inside them.
 */
function anchorFor(card: HTMLElement): Anchor {
  const rect = card.getBoundingClientRect()
  const container = card.closest('aside, [data-slot="popover-content"]') ?? card
  const right = container.getBoundingClientRect().right
  const maxTop = window.innerHeight - PREVIEW_HEIGHT - EDGE
  return { top: Math.max(EDGE, Math.min(rect.top, maxTop)), left: right + EDGE }
}

/**
 * One draggable, clickable card in the Add panel. `Drawer.Item` from `@puckeditor/core`
 * supplies the drag-into-canvas behaviour (dropped wherever the pointer releases, in
 * any zone that accepts it); the click handler is ours — Puck has no built-in one.
 * No entrance animation of its own: the list used to stagger every card in each
 * time it mounted, which replayed on every popover open and read as a flicker.
 */
export default function SectionCard({
  type,
  label,
  description,
  appIcon,
  hovered,
  onHover,
  onAdd,
}: SectionCardProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  // Event handlers
  const handleHover = (e: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    setAnchor(anchorFor(e.currentTarget))
    onHover(type)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onAdd()
  }

  // Render logic
  const source = SECTION_SOURCES[type]
  const preview =
    hovered && anchor ? (
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.12 }}
        style={{ top: anchor.top, left: anchor.left }}
        className="pointer-events-none fixed z-50 hidden w-64 flex-col gap-2 rounded-xl border border-border bg-popover p-2 shadow-popover lg:flex"
      >
        <SectionLivePreview type={type} className="aspect-video w-full" />
        <div className="flex flex-col gap-0.5 px-1 pb-1">
          <span className="text-[0.8125rem] font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
          {source ? (
            <span className="pt-1 text-[0.6875rem] text-muted-foreground">
              {copy.by(source.name)}
            </span>
          ) : null}
        </div>
      </motion.div>
    ) : null

  return (
    <>
      <Drawer.Item name={type}>
        {() => (
          // A div, not a button: Puck's drag sensor won't start a drag from
          // interactive elements, so a <button> here could be clicked but never dragged.
          // biome-ignore lint/a11y/useSemanticElements: see above — a real <button> can't be dragged by Puck.
          <div
            role="button"
            tabIndex={0}
            onClick={onAdd}
            onKeyDown={handleKeyDown}
            onMouseEnter={handleHover}
            onFocus={handleHover}
            className="group/card flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
          >
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors group-hover/card:text-foreground">
              <SectionIcon type={type} className="size-4" />
              {appIcon ? (
                <Image
                  src={appIcon}
                  alt=""
                  width={16}
                  height={16}
                  className="absolute -right-1 -bottom-1 size-4 rounded-full ring-2 ring-card"
                />
              ) : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[0.8125rem] leading-5 font-medium text-foreground">
                {label}
              </span>
              <span className="truncate text-xs leading-4 text-muted-foreground">
                {description}
              </span>
              {source ? (
                <span className="truncate pt-0.5 text-[0.6875rem] leading-4 text-muted-foreground/80">
                  {copy.by(source.name)}
                </span>
              ) : null}
            </span>
          </div>
        )}
      </Drawer.Item>
      {preview ? createPortal(preview, document.body) : null}
    </>
  )
}
