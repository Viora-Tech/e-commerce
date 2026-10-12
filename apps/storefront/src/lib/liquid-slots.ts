/**
 * Hand-off of an imported theme's rendered Liquid from the server components to the server
 * render of the HTML, so the markup is sent once.
 *
 * A server component's props are serialised into the page's RSC payload, which Next inlines in
 * the HTML for hydration. Theme markup passed as a prop was therefore sent twice: once as the
 * page's DOM and once more, escaped, inside the payload (about half of a home page's bytes).
 * Instead, the server component parks the markup here under a random slot id and passes only the
 * id to the client component (`components/theme/liquid-slot.tsx`); the HTML render of that
 * component, in the same process, takes the markup back out. In the browser the slot is never
 * filled: the component keeps the markup the server already put in the DOM.
 *
 * The store lives on `globalThis` because the server components and the HTML render load their
 * own copies of this module. Every slot is taken once; one that never is (the render was
 * aborted) is dropped after `SLOT_TTL_MS`.
 */

type Slot = { html: string; at: number }

const SLOT_TTL_MS = 60_000
const KEY = Symbol.for('commerce.liquidSlots')

type Store = { slots: Map<string, Slot>; swept: number }

function store(): Store | undefined {
  return (globalThis as { [KEY]?: Store })[KEY]
}

/** Drops slots nobody took within the TTL. Map order is insertion order, so oldest first. */
function sweep(s: Store, now: number) {
  if (now - s.swept < SLOT_TTL_MS / 4) return
  s.swept = now
  for (const [id, slot] of s.slots) {
    if (now - slot.at < SLOT_TTL_MS) break
    s.slots.delete(id)
  }
}

/** Parks `html` for this request's HTML render; returns the slot id to pass to the client. Server only. */
export function putLiquidSlot(html: string, now = Date.now()): string {
  const g = globalThis as { [KEY]?: Store }
  const s = g[KEY] ?? { slots: new Map(), swept: now }
  g[KEY] = s
  sweep(s, now)
  const id = crypto.randomUUID()
  s.slots.set(id, { html, at: now })
  return id
}

/** The markup parked under `id`, removed as it is read. Undefined in the browser. */
export function takeLiquidSlot(id: string): string | undefined {
  const s = store()
  const slot = s?.slots.get(id)
  if (!slot) return undefined
  s?.slots.delete(id)
  return slot.html
}

/** How many slots are waiting (tests). */
export function pendingLiquidSlots(): number {
  return store()?.slots.size ?? 0
}
