'use client'

import { SINGLE_SECTIONS } from '@commerce/core/theme'
import { ArrowDown, ArrowUp, Copy, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { registerOverlayPortal } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import { type MouseEvent, type ReactNode, useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { deleteWithCollapse } from '@/lib/customize-canvas-motion'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { findBlock, locateBlock, stepActions, zoneItems } from '@/lib/customize-slots'
import { BLOCK_TOOLBAR_FORMAT_SLOT } from './block-toolbar-format'
import SectionIcon from './section-icon'

type BlockToolbarProps = {
  children: ReactNode
  hover: boolean
  isSelected: boolean
  componentId: string
  componentType: string
}

const copy = customizeContent

/*
 * Puck mounts this overlay in the admin document, laid over the preview iframe, so the bar
 * uses the admin's own tokens and follows its light or dark theme.
 */
const TOOL =
  'flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none'

const SEPARATOR = 'mx-0.5 h-4 w-px shrink-0 bg-border'

/**
 * The one floating toolbar of the selected block on the Customize canvas (Puck's
 * `componentOverlay` override): the block's name in the accent "selected" chip from the
 * Figma builder frames, then move up/down, duplicate and delete (the same Puck actions the
 * Sections tree dispatches, so undo covers both), then — only while text in this block is
 * being edited — Puck's B/I/U and our link control, which `BlockToolbarFormat` portals into
 * the slot at the end. It sits on the block's top edge and, like Puck's own action bar,
 * sticks to the top of the canvas while a tall block scrolls under it (so a block at the
 * very top shows it just inside). A hovered block only gets its dashed outline.
 */
export default function BlockToolbar({
  children,
  hover: _hover,
  isSelected,
  componentId,
  componentType,
}: BlockToolbarProps) {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const components = useCustomizePuck((s) => s.config.components)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const reducedMotion = useReducedMotion()
  const [bar, setBar] = useState<HTMLDivElement | null>(null)
  // Marks the bar as Puck chrome: pressing its buttons neither drags the block nor counts as
  // a click on the canvas (which would clear the selection and close the bar).
  useEffect(() => (bar ? registerOverlayPortal(bar, { disableDrag: true }) : undefined), [bar])

  // Event handlers
  const handleMove = (step: -1 | 1) => {
    const located = locateBlock(data, componentId)
    if (!located) return
    // Reorder and keep the moved block selected, as Alt+Up/Down and the Sections tree do.
    const count = zoneItems(data, located.zone).length
    for (const action of stepActions(located.zone, located.index, count, step)) dispatch(action)
  }
  const handleDuplicate = () => {
    const located = locateBlock(data, componentId)
    if (located)
      dispatch({ type: 'duplicate', sourceIndex: located.index, sourceZone: located.zone })
  }
  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    const located = locateBlock(data, componentId)
    if (!located) return
    const el = e.currentTarget.ownerDocument.querySelector<HTMLElement>(
      `[data-puck-component="${componentId}"]`,
    )
    deleteWithCollapse(dispatch, located, el, reducedMotion === true)
  }

  // Early returns
  const located = locateBlock(data, componentId)
  // `children` is Puck's own outline; a hovered block keeps just that (dashed, vendor-puck.css).
  if (!located || !isSelected) return <>{children}</>

  // Render logic
  const block = findBlock(data, componentId)
  const typeLabel = components[componentType]?.label ?? componentType
  const label = block ? sectionName(block, typeLabel) : typeLabel
  const locked = SINGLE_SECTIONS.has(componentType)
  const { zone, index } = located
  const count = zoneItems(data, zone).length

  return (
    <>
      {children}
      {/* A band from 2.125rem above the block to its bottom: the bar rests at its top (on the
          block's edge) and sticks to the top of the canvas while the block scrolls under it. */}
      <div className="pointer-events-none absolute inset-x-0 -top-[2.125rem] bottom-0">
        <motion.div
          ref={setBar}
          // A click that reached Puck's canvas would clear the selection and close the bar.
          onClick={(e) => e.stopPropagation()}
          role="toolbar"
          aria-label={copy.toolbar.label(label)}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
          className="pointer-events-auto sticky top-1 z-10 flex h-[1.875rem] w-fit items-center gap-1 rounded-lg bg-popover p-[0.1875rem] text-popover-foreground shadow-popover ring-1 ring-border"
        >
          <span className="inline-flex h-6 max-w-[14rem] items-center gap-1 rounded-[0.3125rem] bg-primary px-2 text-xs leading-[1.0625rem] font-medium whitespace-nowrap text-primary-foreground">
            <SectionIcon type={componentType} className="size-3.5 shrink-0 opacity-90" />
            <span className="truncate">{label}</span>
          </span>
          <button
            type="button"
            onClick={() => handleMove(-1)}
            disabled={index === 0}
            aria-label={copy.toolbar.moveUp(label)}
            title={copy.toolbar.moveUp(label)}
            className={TOOL}
          >
            <ArrowUp aria-hidden weight="regular" className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleMove(1)}
            disabled={index === count - 1}
            aria-label={copy.toolbar.moveDown(label)}
            title={copy.toolbar.moveDown(label)}
            className={TOOL}
          >
            <ArrowDown aria-hidden weight="regular" className="size-3.5" />
          </button>
          {locked ? null : (
            <>
              <span aria-hidden className={SEPARATOR} />
              <button
                type="button"
                onClick={handleDuplicate}
                aria-label={copy.tree.duplicate(label)}
                title={copy.tree.duplicate(label)}
                className={TOOL}
              >
                <Copy aria-hidden weight="regular" className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemove}
                aria-label={copy.tree.remove(label)}
                title={copy.tree.remove(label)}
                className={cn(TOOL, 'hover:bg-danger-soft hover:text-danger')}
              >
                <Trash2 aria-hidden weight="regular" className="size-3.5" />
              </button>
            </>
          )}
          {/* Puck's B/I/U and the link control land here while this block's text is edited. */}
          <span {...{ [BLOCK_TOOLBAR_FORMAT_SLOT]: '' }} className="contents" />
        </motion.div>
      </div>
    </>
  )
}
