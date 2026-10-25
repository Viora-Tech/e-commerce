/**
 * When a Zero Drift signup popup opens (port of assets/signup-popup.js).
 *
 *   engaged  from the visitor's second page view, after the delay or once the
 *            page is scrolled past the depth, whichever comes first
 *   exit     the cursor leaving through the top of the window (desktop);
 *            phones have no such gesture and fall back to "engaged"
 *   soon     after the delay, first page included
 *
 * Memory, all wrapped in try/catch because blocked storage throws on access:
 *   localStorage   zero-drift:popup:<section>  when this one was last shown
 *   localStorage   zero-drift:subscribed       set on a successful signup; ends every popup
 *   sessionStorage zero-drift:pages            page loads this visit
 *   sessionStorage zero-drift:popup-seen       which popup this visit showed; the others stay quiet
 *   (read falling back to the `glide:` names browsers saved before the rename, `storage-keys.ts`)
 *   module flag                           one popup per page view
 *
 * Timers use setTimeout and a plain scroll listener, never rAF: rAF is paused in
 * background tabs and the popup would open the moment a visitor came back.
 */

import { readStored, storageKey } from '../../../storage-keys'

export type PopupTrigger = 'engaged' | 'exit' | 'soon'
export type PopupWhere = 'all' | 'collections'

type Area = 'localStorage' | 'sessionStorage'

const DAY_MS = 86_400_000
const SUBSCRIBED = storageKey('subscribed')
const PAGES = storageKey('pages')
const SEEN = storageKey('popup-seen')
/** Never over checkout, the cart or the account pages. */
const QUIET_PATHS = /^\/(cart|checkout|checkouts|account|password|login)(\/|$)/

let counted = false
let shownThisPage = false

function read(area: Area, key: string): string | null {
  try {
    return readStored(window[area], key)
  } catch {
    return null
  }
}

function write(area: Area, key: string, value: string): void {
  try {
    window[area].setItem(key, value)
  } catch {
    // Blocked storage: the popup may come back sooner, nothing worse.
  }
}

export const popupKey = (sectionId: string) => storageKey(`popup:${sectionId}`)

/** Counts this page load once, however many popups the footer holds. */
export function countPage(): void {
  if (counted) return
  counted = true
  write('sessionStorage', PAGES, String(Number(read('sessionStorage', PAGES) ?? '0') + 1))
}

/** Whether this page may show the popup at all (`where`, and never cart or account). */
export function pageAllowed(where: PopupWhere, collections: string, path: string): boolean {
  if (QUIET_PATHS.test(path)) return false
  if (where === 'all') return true
  const handle = /^\/collections\/([^/?#]+)/.exec(path)?.[1]
  const chosen = collections
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  return handle !== undefined && chosen.includes(decodeURIComponent(handle))
}

/** Subscribed, another popup already showed this visit, or this one is still resting. */
export function suppressed(key: string, repeatDays: number): boolean {
  if (shownThisPage || read('localStorage', SUBSCRIBED)) return true
  const seen = read('sessionStorage', SEEN)
  if (seen && seen !== key) return true
  const last = Number(read('localStorage', key) ?? '0')
  return last > 0 && Date.now() - last < Math.max(1, repeatDays) * DAY_MS
}

export function markShown(key: string): void {
  shownThisPage = true
  write('localStorage', key, String(Date.now()))
  write('sessionStorage', SEEN, key)
}

export function markSubscribed(): void {
  write('localStorage', SUBSCRIBED, String(Date.now()))
}

const isPhone = () =>
  !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(max-width: 749px)').matches

/**
 * Starts listening for the moment to open; returns the cleanup. `open` re-checks
 * everything itself, so firing it twice is harmless.
 */
export function armPopup(
  options: { trigger: PopupTrigger; delay: number; delayMobile: number; scroll: number },
  open: () => void,
): () => void {
  const phone = isPhone()
  const seconds = Math.max(1, phone ? options.delayMobile : options.delay)
  const depth = Math.min(Math.max(options.scroll, 10), 100)
  let timer: number | undefined

  const onMouseOut = (e: MouseEvent) => {
    if (!e.relatedTarget && e.clientY <= 0) open()
  }
  const onScroll = () => {
    const range = document.documentElement.scrollHeight - window.innerHeight
    if (range > 0 && (window.scrollY / range) * 100 >= depth) open()
  }

  if (options.trigger === 'exit' && !phone) {
    document.addEventListener('mouseout', onMouseOut)
  } else {
    const pages = Number(read('sessionStorage', PAGES) ?? '1')
    const engaged = options.trigger !== 'soon'
    if (!engaged || pages >= 2) {
      if (engaged) window.addEventListener('scroll', onScroll, { passive: true })
      timer = window.setTimeout(open, seconds * 1000)
    }
  }

  return () => {
    window.clearTimeout(timer)
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('mouseout', onMouseOut)
  }
}

/** The live consent banner is on screen: wait for an answer rather than stack on it. */
export const consentPending = () =>
  document.querySelector('.cookie-banner:not(.cookie-banner--static)') !== null
