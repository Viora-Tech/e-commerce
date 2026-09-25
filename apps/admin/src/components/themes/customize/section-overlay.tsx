'use client'

import { SINGLE_SECTIONS } from '@commerce/core/theme'
import { ArrowDown, ArrowUp, Copy, Trash2 } from '@commerce/ui/icons'
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
          wrapper (themed via CSS tokens), so this replaces only the action chrome. One
          dark pill regardless of admin theme — it sits on top of arbitrary storefront
          colours, so it stays legible in both light and dark preview content. */}
      <motion.div
        key={isSelected ? 'selected' : 'hover'}
        initial={
          reducedMotion ? false : isSelected ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: -4 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          duration: reducedMotion ? 0 : 0.26,
          ease: isSelected ? [0.34, 1.56, 0.64, 1] : 'easeOut',
        }}
        className="pointer-events-none absolute top-0 left-0 z-10 w-full p-1.5"
      >
        <span className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-neutral-900/95 py-1 pr-1 pl-2.5 text-caption font-medium text-white shadow-lg shadow-black/25 backdrop-blur-sm dark:bg-neutral-800/95">
          <SectionIcon type={componentType} className="size-3.5 shrink-0 text-white/80" />
          <span className="truncate">{label}</span>
          {isSelected ? (
            <>
              <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-white/20" />
              <button
                type="button"
                onClick={() => handleMove(index - 1)}
                disabled={index === 0}
                aria-label={copy.overlay.moveUp(label)}
                title={copy.overlay.moveUp(label)}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowUp aria-hidden className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMove(index + 1)}
                disabled={index === count - 1}
                aria-label={copy.overlay.moveDown(label)}
                title={copy.overlay.moveDown(label)}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowDown aria-hidden className="size-3.5" />
              </button>
              {locked ? null : (
                <>
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    aria-label={copy.tree.duplicate(label)}
                    title={copy.tree.duplicate(label)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
                  >
                    <Copy aria-hidden className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    aria-label={copy.tree.remove(label)}
                    title={copy.tree.remove(label)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-destructive/80 hover:text-white"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </button>
                </>
              )}
            </>
          ) : null}
        </span>
      </motion.div>
    </>
  )
}
