'use client'

import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { registerOverlayPortal, useGetPuck } from '@puckeditor/core'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { customizeContent } from '@/data/customize'
import { type CustomizeDoc, locateSection } from '@/lib/customize-doc'
import { type CanvasEdge, edgeNear, type SectionBox, targetForEdge } from '@/lib/customize-insert'
import { useRequestInsert } from '@/lib/customize-insert-context'
import { UNZOOMED, useCanvasZoom } from '@/lib/customize-zoom'

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
 * The part of the canvas the merchant can see across, in canvas pixels: zoomed in, the page is
 * wider than the canvas area (`data-canvas-stage`, scrolled sideways) and the rest is cut off.
 */
function visibleSpan(doc: Document, zoom: number): { left: number; right: number } | null {
  const frame = doc.defaultView?.frameElement
  const stage = frame?.closest('[data-canvas-stage]')
  if (!frame || !stage) return null
  const f = frame.getBoundingClientRect()
  const s = stage.getBoundingClientRect()
  return {
    left: (Math.max(s.left, f.left) - f.left) / zoom,
    right: (Math.min(s.right, f.right) - f.left) / zoom,
  }
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
  // Read when the pointer moves, not subscribed: typing would otherwise redraw this and
  // re-bind its listeners on every key.
  const getPuck = useGetPuck()
  const requestInsert = useRequestInsert()
  const reducedMotion = useReducedMotion()
  const { zoom } = useCanvasZoom()
  const [hit, setHit] = useState<Hit | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const view = document.defaultView
    if (!view) return
    // In canvas pixels: the same distance on screen at any zoom.
    const band =
      (BAND_REM *
        Number.parseFloat(view.getComputedStyle(document.documentElement).fontSize || '16')) /
      zoom
    // At most once a frame: every move measures each section on the page.
    let frame = 0
    let pointerY = 0
    const measure = () => {
      frame = 0
      const entry = document.querySelector('[data-puck-entry]')
      if (entry?.hasAttribute('data-puck-dragging')) {
        setHit(null)
        return
      }
      const boxes = sectionBoxes(document, getPuck().appState.data as unknown as CustomizeDoc)
      const edge = edgeNear(boxes, pointerY, band)
      const box = edge ? boxes.find((b) => b.id === edge.id) : undefined
      if (!edge || !box) {
        setHit(null)
        return
      }
      // Across the part of the section in view, so the "+" never sits off to the side.
      const rect = box.el.getBoundingClientRect()
      const span = visibleSpan(document, zoom)
      const left = Math.max(rect.left, span?.left ?? rect.left)
      const width = Math.min(rect.right, span?.right ?? rect.right) - left
      setHit((prev) =>
        prev &&
        prev.id === edge.id &&
        prev.side === edge.side &&
        prev.y === edge.y &&
        prev.left === left &&
        prev.width === width
          ? prev
          : { ...edge, left, width },
      )
    }
    const handleMove = (e: PointerEvent) => {
      pointerY = e.clientY
      if (!frame) frame = view.requestAnimationFrame(measure)
    }
    const handleHide = () => {
      view.cancelAnimationFrame(frame)
      frame = 0
      setHit(null)
    }
    const root = document.documentElement
    document.addEventListener('pointermove', handleMove)
    root.addEventListener('pointerleave', handleHide)
    view.addEventListener('scroll', handleHide, { passive: true })
    return () => {
      document.removeEventListener('pointermove', handleMove)
      root.removeEventListener('pointerleave', handleHide)
      view.removeEventListener('scroll', handleHide)
      view.cancelAnimationFrame(frame)
    }
  }, [document, getPuck, zoom])

  // Keeps Puck from treating a press on the "+" as the start of a section drag.
  useEffect(() => {
    if (!hit || !buttonRef.current) return
    return registerOverlayPortal(buttonRef.current, { disableDrag: true })
  }, [hit])

  // Event handlers
  const handleInsert = () => {
    if (!hit) return
    const located = locateSection(getPuck().appState.data as unknown as CustomizeDoc, hit.id)
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
          <span className="absolute inset-x-0 h-[calc(0.125rem/var(--canvas-zoom,1))] rounded-full bg-[var(--admin-accent)]" />
          <button
            ref={buttonRef}
            type="button"
            onClick={handleInsert}
            aria-label={label}
            title={label}
            className={cn(
              UNZOOMED,
              'pointer-events-auto relative flex h-6 items-center gap-1 rounded-full bg-[var(--admin-accent)] pr-2.5 pl-1.5 text-xs font-medium text-white shadow-md ring-2 ring-white transition-transform duration-150 hover:scale-105 motion-reduce:transition-none',
            )}
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
