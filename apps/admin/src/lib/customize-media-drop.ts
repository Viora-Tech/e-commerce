import type { Config, PuckAction } from '@puckeditor/core'
import type { CustomizeDoc } from './customize-doc'
import {
  type FieldShape,
  MEDIA_DRAG_TYPE,
  type MediaPick,
  mediaAction,
} from './customize-media-insert'

type PuckState = {
  appState: { data: unknown }
  config: Config
  dispatch: (action: PuckAction) => void
}

/** Marks the block a dragged picture would land in; styled in `CANVAS_DROP_CSS`. */
const DROP_ATTR = 'data-media-drop'

export const CANVAS_DROP_CSS = `[${DROP_ATTR}] { outline: calc(2px / var(--canvas-zoom, 1)) dashed var(--admin-accent, currentColor); outline-offset: calc(-2px / var(--canvas-zoom, 1)); }`

/**
 * Lets a picture dragged from the Media panel be dropped onto a section in the canvas: the
 * innermost block under the pointer that has a picture setting takes it (`mediaAction`),
 * outlined while the picture hovers over it. Returns the cleanup.
 */
export function installMediaDrop(
  doc: Document,
  getPuck: () => PuckState,
  onPlaced: (blockId: string) => void,
): () => void {
  let marked: Element | null = null
  const mark = (el: Element | null) => {
    if (marked === el) return
    marked?.removeAttribute(DROP_ATTR)
    marked = el
    marked?.setAttribute(DROP_ATTR, '')
  }
  const carriesMedia = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes(MEDIA_DRAG_TYPE))
  /** The innermost block under the pointer that can take a picture. */
  const targetOf = (e: DragEvent): Element | null => {
    const { appState, config } = getPuck()
    const doc_ = appState.data as CustomizeDoc
    const fieldsOf = (type: string) =>
      config.components[type]?.fields as Record<string, FieldShape> | undefined
    // Puck's hover outline can sit on top of the block, so look through everything under the
    // pointer for the first element inside a block.
    let el: Element | null = null
    for (const hit of doc.elementsFromPoint(e.clientX, e.clientY)) {
      el = hit.closest('[data-puck-component]')
      if (el) break
    }
    while (el) {
      const id = el.getAttribute('data-puck-component') ?? ''
      if (mediaAction(doc_, fieldsOf, id, { url: 'x', alt: null })) return el
      el = el.parentElement?.closest('[data-puck-component]') ?? null
    }
    return null
  }
  const onOver = (e: DragEvent) => {
    if (!carriesMedia(e)) return
    const target = targetOf(e)
    mark(target)
    if (target) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
  }
  const onLeave = (e: DragEvent) => {
    if (!e.relatedTarget) mark(null)
  }
  const onDrop = (e: DragEvent) => {
    if (!carriesMedia(e)) return
    const target = targetOf(e)
    mark(null)
    if (!target) return
    e.preventDefault()
    let media: MediaPick
    try {
      media = JSON.parse(e.dataTransfer?.getData(MEDIA_DRAG_TYPE) ?? '') as MediaPick
    } catch {
      return
    }
    if (typeof media?.url !== 'string' || !media.url) return
    const { appState, config, dispatch } = getPuck()
    const id = target.getAttribute('data-puck-component') ?? ''
    const fieldsOf = (type: string) =>
      config.components[type]?.fields as Record<string, FieldShape> | undefined
    const action = mediaAction(appState.data as CustomizeDoc, fieldsOf, id, media)
    if (!action) return
    dispatch(action)
    onPlaced(id)
  }
  doc.addEventListener('dragover', onOver)
  doc.addEventListener('dragleave', onLeave)
  doc.addEventListener('drop', onDrop)
  return () => {
    mark(null)
    doc.removeEventListener('dragover', onOver)
    doc.removeEventListener('dragleave', onLeave)
    doc.removeEventListener('drop', onDrop)
  }
}
