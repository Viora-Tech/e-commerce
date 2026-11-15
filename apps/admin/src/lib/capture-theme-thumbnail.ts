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
 *
 * Videos never go into the clone (their poster does, see `stillPosters`): modern-screenshot 4.7
 * waits for a cloned `<video>` to load with no time limit, and a `preload="none"` video (an
 * imported theme's hero slides) never loads, so the capture never finished and no picture was
 * ever saved (an imported theme's white Themes card, 15 Nov 2026). A whole attempt is also capped (`ATTEMPT_TIMEOUT_MS`).
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
/** One attempt that has not finished by now is given up (logged), so a capture never hangs. */
export const ATTEMPT_TIMEOUT_MS = 30_000

/** Marks, on a video's parent, which posters stand in for its videos in the clone. */
const POSTER_SLOT = 'data-screenshot-posters'

/** A video's box, copied onto the poster that replaces it so it lands where the video was. */
const VIDEO_BOX = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'z-index',
  'object-fit',
  'object-position',
  'border-radius',
  'transform',
  'display',
] as const

/**
 * What goes in the picture: not the editor's chrome (Puck's hover and selection layers, our "+"
 * line), no video (`stillPosters` puts its poster there), and nothing below the fold, so a long
 * home page clones and embeds only its top.
 */
export function keeper(fold: number): (node: Node) => boolean {
  return (node) => {
    if (!(node.nodeType === 1)) return true
    const el = node as Element
    if (el.tagName === 'VIDEO') return false
    if (el.hasAttribute('data-screenshot-skip')) return false
    const name = typeof el.className === 'string' ? el.className : ''
    if (/DraggableComponent-overlay|DraggableComponent-actions|canvas-insert/i.test(name)) {
      return false
    }
    return el.getBoundingClientRect().top < fold
  }
}

/**
 * Posters for the page's videos: `mark` tags each video's parent before the clone, `apply` adds
 * an `<img>` of each poster to the cloned parent (sized and placed as the video was), `restore`
 * removes the tags from the live page. A video with no poster leaves its box empty.
 */
export function stillPosters(body: HTMLElement): {
  apply: (cloned: Node) => void
  restore: () => void
} {
  const view = body.ownerDocument.defaultView
  const stills: { poster: string; style: string }[] = []
  const parents = new Map<Element, number[]>()
  for (const video of body.querySelectorAll('video')) {
    const parent = video.parentElement
    if (!video.poster || !parent) continue
    const computed = view?.getComputedStyle(video)
    const style = VIDEO_BOX.map((p) => [p, computed?.getPropertyValue(p) ?? ''] as const)
      .filter(([, v]) => v !== '')
      .map(([p, v]) => `${p}:${v}`)
      .join(';')
    stills.push({ poster: video.poster, style })
    parents.set(parent, [...(parents.get(parent) ?? []), stills.length - 1])
  }
  for (const [parent, slots] of parents) parent.setAttribute(POSTER_SLOT, slots.join(','))
  return {
    apply: (cloned) => {
      const root = cloned as Partial<Element>
      if (!root.querySelectorAll || !root.ownerDocument) return
      const doc = root.ownerDocument
      const holders = [...root.querySelectorAll(`[${POSTER_SLOT}]`)]
      if (root.hasAttribute?.(POSTER_SLOT)) holders.push(root as Element)
      for (const holder of holders) {
        for (const slot of (holder.getAttribute(POSTER_SLOT) ?? '').split(',')) {
          const still = stills[Number(slot)]
          if (!still) continue
          const img = doc.createElement('img')
          img.src = still.poster
          img.alt = ''
          img.setAttribute('style', still.style)
          holder.appendChild(img)
        }
        holder.removeAttribute(POSTER_SLOT)
      }
    },
    restore: () => {
      for (const parent of parents.keys()) parent.removeAttribute(POSTER_SLOT)
    },
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

/** `work`, or a rejection once `ms` pass without it settling. */
export function withinTime<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no picture after ${ms} ms`)), ms)
  })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

/** The canvas's top 16:10 as a webp data URL, or null when there is no canvas, it fails or it is blank. */
export async function captureThemeThumbnail(): Promise<string | null> {
  const frame = document.querySelector<HTMLIFrameElement>(FRAME)
  const doc = frame?.contentDocument
  const body = doc?.body
  const view = frame?.contentWindow
  if (!frame || !doc || !body || !view) return null
  const posters = stillPosters(body)
  try {
    const { domToWebp } = await import('modern-screenshot')
    const width = body.clientWidth || frame.clientWidth
    if (!width) return null
    const height = Math.round(width * ASPECT)
    // Rects are relative to the frame's viewport; the picture is the top of the page.
    const fold = height - view.scrollY
    const background = view.getComputedStyle(body).backgroundColor
    const take = (quality: number, light: boolean) =>
      withinTime(
        domToWebp(body, {
          width,
          height,
          scale: OUTPUT_WIDTH / width,
          quality,
          timeout: light ? LIGHT_TIMEOUT_MS : RESOURCE_TIMEOUT_MS,
          filter: keeper(fold),
          ...(background ? { backgroundColor: background } : {}),
          ...(light ? { font: false as const } : {}),
          onCloneNode: (cloned) => {
            posters.apply(cloned)
            if (light) forceVisible(cloned)
          },
        }),
        ATTEMPT_TIMEOUT_MS,
      )
    for (const light of [false, true]) {
      if (light) await settled(view, doc)
      for (const quality of [0.72, 0.55]) {
        const url = await take(quality, light)
        if (!url.startsWith('data:image/webp') || url.length > MAX_DATA_URL) continue
        // Unreadable counts as fine: the check exists to stop blanks, not to block pictures.
        if ((await isBlankImage(url)) === true) {
          console.warn('Theme picture came out blank', { light })
          break
        }
        return url
      }
    }
    return null
  } catch (err) {
    console.error('Theme picture failed:', err)
    return null
  } finally {
    posters.restore()
  }
}
