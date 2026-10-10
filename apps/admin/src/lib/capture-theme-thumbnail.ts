/**
 * The theme library's picture of a theme: the top of the home page as Customize's canvas draws
 * it, as a 640 × 400 webp data URL. Taken with modern-screenshot (MIT, THIRD_PARTY_NOTICES.md),
 * the library "Report a bug" uses, loaded only when a picture is taken. No headless browser: the
 * canvas is a same-origin iframe that already shows exactly what shoppers see. Browser only.
 */

/** Puck's canvas iframe (`@puckeditor/core`, `id: "preview-frame"`). */
const FRAME = 'iframe#preview-frame'

const OUTPUT_WIDTH = 640
/** 16:10, the shape of the library's picture wells. */
const ASPECT = 10 / 16
/** The server takes up to 256 KB; a 640 × 400 webp is far below it at these qualities. */
const MAX_DATA_URL = 300_000

/** A file the picture needs (an image, a font) that takes longer than this is left out. */
const RESOURCE_TIMEOUT_MS = 4000

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

/** The canvas's top 16:10 as a webp data URL, or null when there is no canvas or it fails. */
export async function captureThemeThumbnail(): Promise<string | null> {
  const frame = document.querySelector<HTMLIFrameElement>(FRAME)
  const body = frame?.contentDocument?.body
  if (!frame || !body) return null
  try {
    const { domToWebp } = await import('modern-screenshot')
    const width = body.clientWidth || frame.clientWidth
    if (!width) return null
    const height = Math.round(width * ASPECT)
    // Rects are relative to the frame's viewport; the picture is the top of the page.
    const fold = height - (frame.contentWindow?.scrollY ?? 0)
    const view = frame.contentWindow
    const background = view ? view.getComputedStyle(body).backgroundColor : undefined
    for (const quality of [0.72, 0.55]) {
      const url = await domToWebp(body, {
        width,
        height,
        scale: OUTPUT_WIDTH / width,
        quality,
        timeout: RESOURCE_TIMEOUT_MS,
        filter: keeper(fold),
        ...(background ? { backgroundColor: background } : {}),
      })
      if (url.startsWith('data:image/webp') && url.length <= MAX_DATA_URL) return url
    }
    return null
  } catch (err) {
    console.error('Theme picture failed:', err)
    return null
  }
}
