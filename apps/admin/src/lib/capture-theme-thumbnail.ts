/**
 * The theme library's picture of a theme: the top of the home page as Customize's canvas draws
 * it, as a 640 × 400 webp data URL. Taken with modern-screenshot (MIT, THIRD_PARTY_NOTICES.md),
 * the library "Report a bug" uses, loaded only when a picture is taken. No headless browser: the
 * canvas is a same-origin iframe that already shows exactly what shoppers see. Browser only.
 *
 * A picture that comes out one flat colour is never returned (`blank-image.ts`): an imported
 * theme can hide its page until its own script runs (which never runs in the canvas), or the
 * frame may not have painted yet, and modern-screenshot then "succeeds" with a white rectangle.
 * One retry waits for fonts and a paint, forces the page visible and skips embedding fonts; still
 * blank, nothing is saved and the Themes card keeps its placeholder.
 */

import { isBlankImage } from './blank-image'

/** Puck's canvas iframe (`@puckeditor/core`, `id: "preview-frame"`). */
const FRAME = 'iframe#preview-frame'

const OUTPUT_WIDTH = 640
/** 16:10, the shape of the library's picture wells. */
const ASPECT = 10 / 16
/** The server takes up to 256 KB; a 640 × 400 webp is far below it at these qualities. */
const MAX_DATA_URL = 300_000

/** A file the picture needs (an image, a font) that takes longer than this is left out. */
const RESOURCE_TIMEOUT_MS = 4000
/** The lighter retry gives slow files less time, so it cannot hang on what blocked the first. */
const LIGHT_TIMEOUT_MS = 2000

/**
 * What goes in the picture: not the editor's chrome (Puck's hover and selection layers, our "+"
 * line), and nothing below the fold, so a long home page clones and embeds only its top.
 */
function keeper(fold: number): (node: Node) => boolean {
  return (node) => {
    if (!(node.nodeType === 1)) return true
    const el = node as Element
    if (el.hasAttribute('data-screenshot-skip')) return false
    const name = typeof el.className === 'string' ? el.className : ''
    if (/DraggableComponent-overlay|DraggableComponent-actions|canvas-insert/i.test(name)) {
      return false
    }
    return el.getBoundingClientRect().top < fold
  }
}

/** Resolves after the frame's fonts load (or a short wait) and two paints. */
async function settled(view: Window, doc: Document): Promise<void> {
  await Promise.race([doc.fonts?.ready, new Promise((r) => view.setTimeout(r, 1500))])
  await new Promise((r) => view.requestAnimationFrame(() => view.requestAnimationFrame(r)))
}

/** The cloned page shown even when the theme keeps it hidden until its script runs. */
function forceVisible(cloned: Node): void {
  // Duck-typed: the clone may come from the frame's realm, where `instanceof HTMLElement` fails.
  const style = (cloned as Partial<HTMLElement>).style
  if (!style) return
  style.setProperty('visibility', 'visible', 'important')
  style.setProperty('opacity', '1', 'important')
}

/** The canvas's top 16:10 as a webp data URL, or null when there is no canvas, it fails or it is blank. */
export async function captureThemeThumbnail(): Promise<string | null> {
  const frame = document.querySelector<HTMLIFrameElement>(FRAME)
  const doc = frame?.contentDocument
  const body = doc?.body
  const view = frame?.contentWindow
  if (!frame || !doc || !body || !view) return null
  try {
    const { domToWebp } = await import('modern-screenshot')
    const width = body.clientWidth || frame.clientWidth
    if (!width) return null
    const height = Math.round(width * ASPECT)
    // Rects are relative to the frame's viewport; the picture is the top of the page.
    const fold = height - view.scrollY
    const background = view.getComputedStyle(body).backgroundColor
    const take = (quality: number, light: boolean) =>
      domToWebp(body, {
        width,
        height,
        scale: OUTPUT_WIDTH / width,
        quality,
        timeout: light ? LIGHT_TIMEOUT_MS : RESOURCE_TIMEOUT_MS,
        filter: keeper(fold),
        ...(background ? { backgroundColor: background } : {}),
        ...(light ? { font: false as const, onCloneNode: forceVisible } : {}),
      })
    for (const light of [false, true]) {
      if (light) await settled(view, doc)
      for (const quality of [0.72, 0.55]) {
        const url = await take(quality, light)
        if (!url.startsWith('data:image/webp') || url.length > MAX_DATA_URL) continue
        // Unreadable counts as fine: the check exists to stop blanks, not to block pictures.
        if ((await isBlankImage(url)) === true) break
        return url
      }
    }
    return null
  } catch (err) {
    console.error('Theme picture failed:', err)
    return null
  }
}
