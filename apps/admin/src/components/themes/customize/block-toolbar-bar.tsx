'use client'

import { SINGLE_SECTIONS } from '@commerce/core/theme'
import { ArrowDown, ArrowUp, ChevronUpIcon, Copy, GripVertical, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { registerOverlayPortal } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import { type MouseEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { forwardSectionDrag } from '@/lib/customize-canvas-interaction'
import { deleteWithCollapse } from '@/lib/customize-canvas-motion'
import { copyBlock } from '@/lib/customize-clipboard'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { findBlock, locateBlock, slotOwner, stepActions, zoneItems } from '@/lib/customize-slots'
import { UNZOOMED } from '@/lib/customize-zoom'
import { BLOCK_TOOLBAR_FORMAT_SLOT } from './block-toolbar-format'
import BlockToolbarMore from './block-toolbar-more'

type BlockToolbarBarProps = {
  isSelected: boolean
  componentId: string
  componentType: string
}

const copy = customizeContent

/*
 * Figma: "Builder / Block toolbar" (500:5981, Online store page), built from the "Selected
 * label" chip (369:5850) and the glass link popover (369:124622). Puck mounts this overlay in
 * the canvas with the admin's stylesheet, so admin tokens apply and light/dark follow the admin.
 */
const BAR =
  'glass-popover pointer-events-auto sticky top-1 z-10 flex h-[1.875rem] w-fit items-center gap-0.5 rounded-[0.625rem] border border-glass-border p-[0.1875rem]'

const CHIP =
  'inline-flex max-w-[14rem] items-center rounded-[0.3125rem] px-2 py-0.5 text-xs leading-[1.0625rem] font-medium whitespace-nowrap'

const TOOL =
  'flex size-6 shrink-0 items-center justify-center rounded-[0.375rem] text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none'

const SEPARATOR = 'mx-0.5 h-4 w-px shrink-0 bg-border'

/**
 * The one floating toolbar on the Customize canvas, mounted by `BlockToolbar` (Puck's
 * `componentOverlay` override) only for the hovered and the selected block, so the document
 * subscription below is one or two per canvas rather than one per block.
 *
 * - Selected: the block's name chip, "select container" for a block inside a layout block,
 *   move up/down, duplicate, delete and a "more" menu (hide, copy). Moves use the same Puck
 *   actions as the Sections tree and Alt+Up/Down, so undo covers them and the block stays
 *   selected.
 * - Text editing: the name chip, then bold, italic, underline, link and clear formatting in
 *   place of the block actions. `BlockToolbarFormat` portals Puck's inline menu into the slot,
 *   and the bar's `:has()` rule swaps the groups, so no state has to cross the portal.
 * - Hovered: the name only, in a quiet chip.
 *
 * It rests on the block's top edge and sticks to the top of the canvas while a tall block
 * scrolls under it (a block at the very top shows it just inside).
 */
export default function BlockToolbarBar({
  isSelected,
  componentId,
  componentType,
}: BlockToolbarBarProps) {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const components = useCustomizePuck((s) => s.config.components)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const reducedMotion = useReducedMotion()
  const [bar, setBar] = useState<HTMLDivElement | null>(null)
  // Marks the bar as Puck chrome: pressing its buttons neither drags the block nor counts as
  // a click on the canvas (which would clear the selection and close the bar).
  useEffect(() => (bar ? registerOverlayPortal(bar, { disableDrag: true }) : undefined), [bar])
  // The grip is the one place a section is picked up on the canvas: its press is handed to the
  // section (lib/customize-canvas-interaction). Same capture phase as the portal's guard above,
  // which keeps the press itself from reaching the section.
  useEffect(() => {
    if (!bar) return
    const handlePointerDown = (e: PointerEvent) => {
      // The bar is in the canvas frame, whose elements are not this window's `Element`.
      const target = e.target as Element | null
      if (target?.closest?.('[data-section-grip]')) forwardSectionDrag(e, componentId)
    }
    bar.addEventListener('pointerdown', handlePointerDown, true)
    return () => bar.removeEventListener('pointerdown', handlePointerDown, true)
  }, [bar, componentId])

  // Helpers
  const labelOf = (type: string): string => components[type]?.label ?? type

  // Event handlers
  const handleMove = (step: -1 | 1) => {
    const located = locateBlock(data, componentId)
    if (!located) return
    const count = zoneItems(data, located.zone).length
    for (const action of stepActions(located.zone, located.index, count, step)) dispatch(action)
  }
  const handleSelectParent = () => {
    const located = locateBlock(data, componentId)
    const owner = located ? slotOwner(data, located.zone) : null
    if (owner)
      dispatch({ type: 'setUi', ui: { itemSelector: { index: owner.index, zone: owner.zone } } })
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
  const handleToggleHidden = () => {
    const located = locateBlock(data, componentId)
    const block = findBlock(data, componentId)
    if (!located || !block) return
    dispatch({
      type: 'replace',
      destinationIndex: located.index,
      destinationZone: located.zone,
      data: { ...block, props: { ...block.props, _hidden: block.props._hidden !== true } },
    })
  }
  const handleCopy = () => {
    const block = findBlock(data, componentId)
    if (!block) return
    copyBlock(block)
    toast.success(copy.clipboard.copied(sectionName(block, labelOf(block.type))))
  }

  // Early returns
  const located = locateBlock(data, componentId)
  if (!located) return null

  // Render logic
  const block = findBlock(data, componentId)
  const typeLabel = labelOf(componentType)
  const label = block ? sectionName(block, typeLabel) : typeLabel
  const locked = SINGLE_SECTIONS.has(componentType)
  const { zone, index } = located
  const count = zoneItems(data, zone).length
  const owner = slotOwner(data, zone)
  const ownerBlock = owner ? findBlock(data, owner.id) : null
  const ownerLabel = ownerBlock ? sectionName(ownerBlock, labelOf(ownerBlock.type)) : null
  const fade = {
    initial: reducedMotion ? false : { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' as const },
  }

  return (
    <>
      {/* A band from the bar's height (1.875rem on screen, at any canvas zoom) above the block to
          its bottom: the bar sits on the block's top edge, flush with its left side (Figma
          369:5160), and sticks to the top of the canvas while the block scrolls under it. The bar
          and chip undo the canvas zoom (`UNZOOMED`). */}
      <div className="pointer-events-none absolute inset-x-0 -top-[calc(1.875rem/var(--canvas-zoom,1))] bottom-0">
        {isSelected ? (
          <motion.div
            ref={setBar}
            // A click that reached Puck's canvas would clear the selection and close the bar.
            onClick={(e) => e.stopPropagation()}
            role="toolbar"
            aria-label={copy.toolbar.label(label)}
            {...fade}
            className={cn(
              BAR,
              UNZOOMED,
              // While text is being edited the format controls replace the block actions.
              '[&:has([data-block-toolbar-format]>*)_[data-block-actions]]:hidden',
            )}
          >
            {locked ? null : (
              <span
                data-section-grip=""
                role="img"
                aria-label={copy.toolbar.drag(label)}
                title={copy.toolbar.drag(label)}
                className={cn(TOOL, 'w-4 cursor-grab active:cursor-grabbing')}
              >
                <GripVertical aria-hidden weight="bold" className="size-3.5" />
              </span>
            )}
            <span className={cn(CHIP, 'bg-primary text-primary-foreground')}>
              <span className="truncate">{label}</span>
            </span>
            <span data-block-actions="" className="contents">
              {owner && ownerLabel ? (
                <button
                  type="button"
                  onClick={handleSelectParent}
                  aria-label={copy.toolbar.selectParent(ownerLabel)}
                  title={copy.toolbar.selectParent(ownerLabel)}
                  className={TOOL}
                >
                  <ChevronUpIcon aria-hidden weight="regular" className="size-3.5" />
                </button>
              ) : null}
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
              <span aria-hidden className={SEPARATOR} />
              <BlockToolbarMore
                label={label}
                hidden={block?.props._hidden === true}
                onToggleHidden={handleToggleHidden}
                onCopy={handleCopy}
              />
            </span>
            {/* Puck's B/I/U plus link and clear formatting land here while text is edited. */}
            <span {...{ [BLOCK_TOOLBAR_FORMAT_SLOT]: '' }} className="contents" />
          </motion.div>
        ) : (
          <motion.span
            {...fade}
            className={cn(
              CHIP,
              UNZOOMED,
              // Rests on the block's edge like the bar (the 1.875rem band minus its own height).
              'sticky top-1 mt-[0.4375rem] w-fit border border-border bg-popover text-popover-foreground',
            )}
          >
            <span className="truncate">{label}</span>
          </motion.span>
        )}
      </div>
    </>
  )
}
