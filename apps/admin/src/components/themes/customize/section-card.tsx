'use client'

import { Drawer } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import type { KeyboardEvent } from 'react'
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
  index: number
}

/**
 * One draggable, clickable card in the Add panel. `Drawer.Item` from `@puckeditor/core`
 * supplies the drag-into-canvas behaviour (dropped wherever the pointer releases, in
 * any zone that accepts it); the click handler is ours — Puck has no built-in one.
 */
export default function SectionCard({
  type,
  label,
  description,
  appIcon,
  hovered,
  onHover,
  onAdd,
  index,
}: SectionCardProps) {
  // Hooks
  const reducedMotion = useReducedMotion()

  // Event handlers
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onAdd()
  }

  // Render logic
  return (
    <>
      <Drawer.Item name={type}>
        {() => (
          // A div, not a button: Puck's drag sensor won't start a drag from
          // interactive elements, so a <button> here could be clicked but never dragged.
          <motion.div
            role="button"
            tabIndex={0}
            onClick={onAdd}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => onHover(type)}
            onFocus={() => onHover(type)}
            initial={reducedMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.22, ease: 'easeOut', delay: index * 0.025 }
            }
            className="flex w-full cursor-grab items-start gap-3 rounded-md p-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
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
            <span className="flex min-w-0 flex-col">
              <span className="text-body-strong">{label}</span>
              <span className="truncate text-caption text-muted-foreground">{description}</span>
            </span>
          </motion.div>
        )}
      </Drawer.Item>
      {hovered ? (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.1 }}
          className="pointer-events-none absolute top-0 left-full ml-2 hidden w-52 flex-col gap-2 rounded-lg border border-border bg-popover p-2 shadow-popover lg:flex"
        >
          <SectionLivePreview type={type} className="aspect-video w-full" />
          <div className="flex flex-col gap-0.5 px-1 pb-1">
            <span className="text-body-strong">{label}</span>
            <span className="text-caption text-muted-foreground">{description}</span>
          </div>
        </motion.div>
      ) : null}
    </>
  )
}
