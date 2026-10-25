/**
 * SOURCE OF TRUTH: requests from the Customize canvas to the editor's panels — WHAT: "show this
 * block's field" (a click on a heading, text or image in the canvas) and "ask AI about this
 * block" (the floating toolbar's AI button) / WHY: the canvas toolbar and click handler live in
 * Puck's iframe overlay, far from the inspector and the AI panel, so they talk through window
 * events instead of threading callbacks through Puck.
 *
 * Plain DOM logic with no JSX. The overlay renders in the admin's React tree, so `window` here
 * is always the admin's window.
 */

import { fieldForClick } from './customize-field-target'

export type FieldFocusRequest = {
  blockId: string
  /** The prop's name in the block's fields (`heading`, `image`, `slides`). */
  field: string
  /** Put the cursor in the field (false when the text is being edited on the canvas itself). */
  focus: boolean
  /** Open the field's image picker (a second click on an image of the selected block). */
  pickImage: boolean
}

export type AskAiRequest = { blockId: string; label: string }

const FIELD_EVENT = 'customize:focus-field'
const ASK_AI_EVENT = 'customize:ask-ai'

function listen<T>(name: string, handler: (detail: T) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<T>).detail)
  window.addEventListener(name, listener)
  return () => window.removeEventListener(name, listener)
}

/** The inspector scrolls to the field (and focuses it, or opens its image picker). */
export function requestFieldFocus(request: FieldFocusRequest): void {
  window.dispatchEvent(new CustomEvent(FIELD_EVENT, { detail: request }))
}

export function onFieldFocus(handler: (request: FieldFocusRequest) => void): () => void {
  return listen(FIELD_EVENT, handler)
}

/** The editor opens the AI panel aimed at this block. */
export function requestAskAi(request: AskAiRequest): void {
  window.dispatchEvent(new CustomEvent(ASK_AI_EVENT, { detail: request }))
}

export function onAskAi(handler: (request: AskAiRequest) => void): () => void {
  return listen(ASK_AI_EVENT, handler)
}

/** Elements whose words are one field: headings, paragraphs, buttons, links, list items. */
const TEXT_ELEMENTS =
  'h1, h2, h3, h4, h5, h6, p, a, button, li, label, figcaption, blockquote, span'

/**
 * Clicks on the canvas ask the inspector for the field they mean (`fieldForClick`): the first
 * click on a block selects it (Puck) and shows its field; a click on an image of the block that
 * was already selected opens that image's picker. Text being edited in place keeps its cursor.
 * Returns the uninstaller.
 */
export function installFieldClicks(
  doc: Document,
  read: {
    selectedId: () => string | null
    props: (blockId: string) => Record<string, unknown> | null
  },
): () => void {
  const view = doc.defaultView
  if (!view) return () => {}
  let wasSelected: string | null = null
  // Before Puck changes the selection: which block was selected when the press began.
  const handlePointerDown = () => {
    wasSelected = read.selectedId()
  }
  const handleClick = (e: MouseEvent) => {
    if (!(e.target instanceof view.Element)) return
    const target = e.target
    // The toolbar and other editor chrome are not the page.
    if (target.closest('[role="toolbar"]')) return
    const block = target.closest('[data-puck-component]')
    const blockId = block?.getAttribute('data-puck-component')
    if (!blockId) return
    const props = read.props(blockId)
    if (!props) return
    const img = target.closest('img')
    const words = target.closest(TEXT_ELEMENTS)?.textContent ?? ''
    const hit = fieldForClick(props, {
      image: img?.currentSrc || img?.getAttribute('src') || null,
      text: words.slice(0, 400),
    })
    if (!hit) return
    const editing = Boolean(target.closest('[contenteditable="true"]'))
    const pickImage = hit.image && wasSelected === blockId
    // After Puck's own click handler: the inspector shows the block first.
    view.setTimeout(
      () => requestFieldFocus({ blockId, field: hit.field, focus: !editing, pickImage }),
      80,
    )
  }
  view.addEventListener('pointerdown', handlePointerDown, true)
  view.addEventListener('click', handleClick)
  return () => {
    view.removeEventListener('pointerdown', handlePointerDown, true)
    view.removeEventListener('click', handleClick)
  }
}
