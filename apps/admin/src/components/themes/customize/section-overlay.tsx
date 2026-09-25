'use client'

import { SINGLE_SECTIONS } from '@commerce/core/theme'
import { ArrowDown, ArrowUp, Copy, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import type { MouseEvent, ReactNode } from 'react'
import { customizeContent } from '@/data/customize'
import { deleteWithCollapse } from '@/lib/customize-canvas-motion'
import { type CustomizeDoc, locateSection, zoneSections } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import SectionIcon from './section-icon'

type SectionOverlayProps = {
  children: ReactNode
  hover: boolean
  isSelected: boolean
  componentId: string
  componentType: string
}

const copy = customizeContent

const TOOL =
  'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-30'

/**
 * Puck's `componentOverlay` override: the accent outline itself is themed by
 * CSS tokens (vendor-puck.css), so this only adds the label pill and the
 * quick actions — move up/down, duplicate, remove — using the same dispatch
 * calls the Sections tree uses, so both stay in sync through Puck's history.
 */
export default function SectionOverlay({
  children,
  hover,
  isSelected,
  componentId,
  componentType,
}: SectionOverlayProps) {
  // Hooks
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const components = useCustomizePuck((s) => s.config.components)
  const reducedMotion = useReducedMotion()
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)

  // Event handlers
  const handleMove = (offset: number) => {
    const located = locateSection(data, componentId)
    if (!located) return
    const to = located.index + offset
    if (to < 0 || to >= zoneSections(data, located.zone).length) return
    dispatch({
      type: 'reorder',
      sourceIndex: located.index,
      destinationIndex: to,
      destinationZone: located.zone,
    })
  }
  const handleDuplicate = () => {
    const located = locateSection(data, componentId)
    if (located)
      dispatch({ type: 'duplicate', sourceIndex: located.index, sourceZone: located.zone })
  }
  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    const located = locateSection(data, componentId)
    if (!located) return
    const doc = e.currentTarget.ownerDocument
    const el = doc.querySelector<HTMLElement>(`[data-puck-component="${componentId}"]`)
    deleteWithCollapse(dispatch, located, el, reducedMotion === true)
  }

  // Early returns
  const located = locateSection(data, componentId)
  if (!located || !(hover || isSelected)) return <>{children}</>

  // Render logic
  const label = components[componentType]?.label ?? componentType
  const locked = SINGLE_SECTIONS.has(componentType)
  const { zone, index } = located
  const count = zoneSections(data, zone).length

  return (
    <>
      {/* Puck's own overlay content stays out: the accent outline is drawn by its parent
          wrapper (themed via CSS tokens), so this replaces only the action chrome. This
          renders inside the preview iframe, where the storefront theme redefines the
          admin's token names, so the chrome uses the fixed neutral palette to stay
          legible over any storefront colours in light and dark previews. */}
      <motion.div
        key={isSelected ? 'selected' : 'hover'}
        initial={reducedMotion ? false : { opacity: 0, y: -4, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: reducedMotion ? 0 : 0.22,
          ease: isSelected ? [0.34, 1.56, 0.64, 1] : 'easeOut',
        }}
        className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-start justify-between gap-2 p-2"
      >
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-caption font-medium shadow-md',
            isSelected
              ? 'bg-neutral-900 text-white'
              : 'bg-white/95 text-neutral-700 ring-1 ring-neutral-200',
          )}
        >
          <SectionIcon type={componentType} className="size-3.5 shrink-0 opacity-80" />
          <span className="truncate">{label}</span>
        </span>
        {isSelected ? (
          <span className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full bg-white/95 p-1 text-neutral-600 shadow-lg shadow-black/15 ring-1 ring-neutral-200 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => handleMove(index - 1)}
              disabled={index === 0}
              aria-label={copy.overlay.moveUp(label)}
              title={copy.overlay.moveUp(label)}
              className={TOOL}
            >
              <ArrowUp aria-hidden weight="light" className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => handleMove(index + 1)}
              disabled={index === count - 1}
              aria-label={copy.overlay.moveDown(label)}
              title={copy.overlay.moveDown(label)}
              className={TOOL}
            >
              <ArrowDown aria-hidden weight="light" className="size-4" />
            </button>
            {locked ? null : (
              <>
                <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-neutral-200" />
                <button
                  type="button"
                  onClick={handleDuplicate}
                  aria-label={copy.tree.duplicate(label)}
                  title={copy.tree.duplicate(label)}
                  className={TOOL}
                >
                  <Copy aria-hidden weight="light" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  aria-label={copy.tree.remove(label)}
                  title={copy.tree.remove(label)}
                  className={cn(TOOL, 'hover:bg-red-50 hover:text-red-600')}
                >
                  <Trash2 aria-hidden weight="light" className="size-4" />
                </button>
              </>
            )}
          </span>
        ) : null}
      </motion.div>
    </>
  )
}
