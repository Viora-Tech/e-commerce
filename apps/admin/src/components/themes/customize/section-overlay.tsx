'use client'

import { SINGLE_SECTIONS } from '@commerce/core/theme'
import { ArrowDown, ArrowUp, Copy, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { customizeContent } from '@/data/customize'
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
  const handleRemove = () => {
    const located = locateSection(data, componentId)
    if (located) dispatch({ type: 'remove', index: located.index, zone: located.zone })
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
          wrapper (themed via CSS tokens), so this replaces only the action chrome. */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.12 }}
        className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-start justify-between p-1.5"
      >
        <span
          className={cn(
            'pointer-events-auto flex items-center gap-1 rounded-full py-1 pr-2.5 pl-1.5 text-caption font-medium shadow-sm',
            isSelected
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground ring-1 ring-border',
          )}
        >
          <SectionIcon type={componentType} className="size-3.5" />
          {label}
        </span>
        {isSelected ? (
          <span className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-card p-1 shadow-sm ring-1 ring-border">
            <button
              type="button"
              onClick={() => handleMove(index - 1)}
              disabled={index === 0}
              aria-label={copy.overlay.moveUp(label)}
              title={copy.overlay.moveUp(label)}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowUp aria-hidden className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleMove(index + 1)}
              disabled={index === count - 1}
              aria-label={copy.overlay.moveDown(label)}
              title={copy.overlay.moveDown(label)}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
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
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Copy aria-hidden className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  aria-label={copy.tree.remove(label)}
                  title={copy.tree.remove(label)}
                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </>
            )}
          </span>
        ) : null}
      </motion.div>
    </>
  )
}
