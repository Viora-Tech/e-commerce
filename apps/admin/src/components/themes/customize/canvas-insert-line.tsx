'use client'

import { Plus } from '@commerce/ui/icons'
import { registerOverlayPortal } from '@puckeditor/core'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { customizeContent } from '@/data/customize'
import { type CustomizeDoc, locateSection } from '@/lib/customize-doc'
import { type CanvasEdge, edgeNear, type SectionBox, targetForEdge } from '@/lib/customize-insert'
import { useRequestInsert } from '@/lib/customize-insert-context'
import { useCustomizePuck } from '@/lib/customize-puck'

type CanvasInsertLineProps = {
  /** The preview iframe's document. */
  document: Document
}

type Hit = CanvasEdge & { left: number; width: number }

/** How close (in rem) the pointer must be to a section edge for the line to show. */
const BAND_REM = 0.75

/** The top-level sections on the canvas (not blocks nested inside them), as boxes. */
function sectionBoxes(doc: Document, data: CustomizeDoc): (SectionBox & { el: HTMLElement })[] {
  return [...doc.querySelectorAll<HTMLElement>('[data-puck-component]')]
    .filter((el) => locateSection(data, el.getAttribute('data-puck-component') ?? '') !== null)
    .map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        id: el.getAttribute('data-puck-component') ?? '',
        top: rect.top,
        bottom: rect.bottom,
        el,
      }
    })
}

/**
 * The canvas's "+" between sections: move the pointer near the edge between
 * two sections and a thin accent line with a "+" appears there; clicking it
 * opens the Add section browser for that exact spot. Drawn as our own layer
 * in the preview (not in Puck's per-section overlay, which unmounts as soon
 * as the pointer leaves its section and would make the "+" unreachable).
 */
export default function CanvasInsertLine({ document }: CanvasInsertLineProps) {
  // Hooks
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const requestInsert = useRequestInsert()
  const reducedMotion = useReducedMotion()
  const [hit, setHit] = useState<Hit | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const view = document.defaultView
    if (!view) return
    const band =
      BAND_REM * Number.parseFloat(view.getComputedStyle(document.documentElement).fontSize || '16')
    const handleMove = (e: PointerEvent) => {
      const entry = document.querySelector('[data-puck-entry]')
      if (entry?.hasAttribute('data-puck-dragging')) {
        setHit(null)
        return
      }
      const boxes = sectionBoxes(document, data)
      const edge = edgeNear(boxes, e.clientY, band)
      const box = edge ? boxes.find((b) => b.id === edge.id) : undefined
      if (!edge || !box) {
        setHit(null)
        return
      }
      const rect = box.el.getBoundingClientRect()
      setHit((prev) =>
        prev && prev.id === edge.id && prev.side === edge.side && prev.y === edge.y
          ? prev
          : { ...edge, left: rect.left, width: rect.width },
      )
    }
    const handleHide = () => setHit(null)
    const root = document.documentElement
    document.addEventListener('pointermove', handleMove)
    root.addEventListener('pointerleave', handleHide)
    view.addEventListener('scroll', handleHide, { passive: true })
    return () => {
      document.removeEventListener('pointermove', handleMove)
      root.removeEventListener('pointerleave', handleHide)
      view.removeEventListener('scroll', handleHide)
    }
  }, [document, data])

  // Keeps Puck from treating a press on the "+" as the start of a section drag.
  useEffect(() => {
    if (!hit || !buttonRef.current) return
    return registerOverlayPortal(buttonRef.current, { disableDrag: true })
  }, [hit])

  // Event handlers
  const handleInsert = () => {
    if (!hit) return
    const located = locateSection(data, hit.id)
    if (!located) return
    setHit(null)
    requestInsert(targetForEdge(hit, located))
  }

  // Render logic
  const label = customizeContent.tree.insertHere

  return createPortal(
    <AnimatePresence>
      {hit ? (
        <motion.div
          key={`${hit.id}-${hit.side}`}
          initial={reducedMotion ? false : { opacity: 0, scaleX: 0.96 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
          style={{ top: hit.y, left: hit.left, width: hit.width }}
          // Fixed palette plus the admin accent: this sits over storefront colours.
          className="pointer-events-none fixed z-50 flex h-0 items-center justify-center"
        >
          <span className="absolute inset-x-0 h-0.5 rounded-full bg-[var(--admin-accent)]" />
          <button
            ref={buttonRef}
            type="button"
            onClick={handleInsert}
            aria-label={label}
            title={label}
            className="pointer-events-auto relative flex h-6 items-center gap-1 rounded-full bg-[var(--admin-accent)] pr-2.5 pl-1.5 text-xs font-medium text-white shadow-md ring-2 ring-white transition-transform duration-150 hover:scale-105 motion-reduce:transition-none"
          >
            <Plus aria-hidden className="size-3.5" />
            {label}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
