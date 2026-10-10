'use client'

import { SECTION_SOURCES } from '@commerce/blocks/puck'
import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Drawer } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import { type FocusEvent, type KeyboardEvent, type MouseEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { appIcon as appIconFor } from '@/apps/app-icons'
import { customizeContent } from '@/data/customize'
import {
  CHROME_FOCUS,
  CHROME_META,
  CHROME_ROW_HOVER,
  CHROME_TRANSITION,
} from '@/lib/customize-chrome'
import SectionIcon from './section-icon'
import SectionLivePreview from './section-live-preview'
import SectionPicture, { hasSectionPicture } from './section-picture'
import SectionPreview from './section-preview'

type SectionCardProps = {
  type: string
  label: string
  description: string
  /** Set for an app-contributed block, shown as a small badge over the glyph. */
  appIcon?: string | undefined
  hovered: boolean
  onHover: (type: string | null) => void
  onAdd: () => void
  /**
   * `tile` (Figma 369:4918): caption above an 8 × 5.5 rem tile with the section's picture (its
   * drawn glyph when it has none), two per row.
   */
  layout?: 'row' | 'tile'
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
  layout = 'row',
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
  const AppBadge = appIcon ? appIconFor(appIcon) : null
  const source = SECTION_SOURCES[type]
  const pictured = hasSectionPicture(type)
  const preview =
    hovered && anchor ? (
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.12 }}
        style={{ top: anchor.top, left: anchor.left }}
        className="pointer-events-none fixed z-50 hidden w-64 flex-col gap-2 rounded-xl border border-border bg-popover p-2 shadow-dialog lg:flex"
      >
        {pictured ? (
          <SectionPicture
            type={type}
            label={label}
            fit="card"
            className="w-full rounded-md border border-border"
          />
        ) : (
          <SectionLivePreview type={type} className="aspect-video w-full" />
        )}
        <div className="flex flex-col gap-0.5 px-1 pb-1">
          <span className="text-[0.8125rem] font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
          {source ? <span className={cn('pt-1', CHROME_META)}>{copy.by(source.name)}</span> : null}
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
            className={cn(
              layout === 'tile'
                ? 'group/card flex w-full min-w-0 cursor-grab flex-col gap-1.5 rounded-lg text-left active:cursor-grabbing'
                : 'group/card flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 text-left active:cursor-grabbing',
              layout === 'row' && CHROME_ROW_HOVER,
              CHROME_TRANSITION,
              CHROME_FOCUS,
            )}
          >
            {layout === 'tile' ? (
              <>
                <span className="truncate text-[0.625rem] leading-[1.0625rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                  {label}
                </span>
                <span className="relative flex aspect-[128/88] w-full overflow-hidden rounded-[0.625rem] border border-border bg-muted transition-[border-color,box-shadow] group-hover/card:border-primary group-hover/card:shadow-lift group-focus-visible/card:border-primary">
                  {pictured ? (
                    <SectionPicture type={type} label={label} fit="tile" className="size-full" />
                  ) : (
                    <SectionPreview
                      type={type}
                      className="size-full rounded-none border-0 bg-muted [&_.bg-muted]:bg-muted [&_.bg-muted-foreground\/30]:bg-primary/70 [&_.border-muted-foreground\/40]:border-primary/70"
                    />
                  )}
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-visible/card:opacity-100 motion-reduce:transition-none">
                    <span className="flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground shadow-sm">
                      <Plus aria-hidden className="size-3" />
                      {copy.add}
                    </span>
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="relative flex shrink-0">
                  <SectionIcon type={type} tile="md" />
                  {AppBadge ? (
                    // `appIcon` is an icon name from the app's manifest ("CreditCard"), not a URL.
                    <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-card text-foreground ring-1 ring-border">
                      <AppBadge aria-hidden weight="regular" className="size-2.5" />
                    </span>
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
                    <span className={cn('truncate pt-0.5', CHROME_META)}>
                      {copy.by(source.name)}
                    </span>
                  ) : null}
                </span>
              </>
            )}
          </div>
        )}
      </Drawer.Item>
      {preview ? createPortal(preview, document.body) : null}
    </>
  )
}
