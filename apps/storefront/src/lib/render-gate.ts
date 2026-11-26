import { loadEnv } from '@commerce/config'
import { logger } from '@commerce/observability/logging'

/**
 * The storefront's render queue: at most a few cache-miss renders (an imported theme's Liquid
 * sections or layout, with their database reads) run at once in this process; the rest wait,
 * likely shoppers first and crawlers last. On 26 Nov 2026 a bot's ~250 probe paths each started
 * a full theme render, the container's CPU saturated and one home-page load took ~65 s. With
 * the queue, a burst costs time for the burst, not for the shoppers behind it.
 *
 * Pure apart from the process singleton (`renderGate`): the proxy reads how busy the queue is
 * (to send crawlers a 503 while it is backed up) and issues each page request a ticket; the
 * render (`render-slot.ts`) waits its turn under that ticket. Both sit on `globalThis`, since the
 * proxy and the app's server bundles are separate module copies in one process.
 */

/** Who is waiting. Lower goes first. */
export const PRIORITY = { shopper: 0, visitor: 1, bot: 2 } as const
export type RenderPriority = (typeof PRIORITY)[keyof typeof PRIORITY]

/** Cache-miss renders one process runs at once when `STOREFRONT_RENDER_SLOTS` is unset. */
export const DEFAULT_RENDER_SLOTS = 4
/** Once someone has waited this long for a slot, crawlers get a 503 instead of a place in line. */
export const BUSY_WAIT_MS = 5_000
/** What the 503 tells a crawler, in seconds. */
export const RETRY_AFTER_S = 30
/** The queue staying non-empty this long is logged as a warning... */
export const QUEUE_WARN_MS = 3_000
/** ...at most this often. */
const QUEUE_WARN_EVERY_MS = 30_000
/** A ticket outlives any render; after this the proxy's entry is dropped. */
const TICKET_TTL_MS = 2 * 60_000
/** And never more than this many at once (a flood with no disconnects). */
const MAX_TICKETS = 20_000

/** Thrown into a render whose visitor has gone: nothing is left to draw it for. */
export class RenderAbortedError extends Error {
  constructor() {
    super('The visitor left before the page rendered')
    this.name = 'RenderAborted'
  }
}

/** User agents that are no shopper: search and AI crawlers, scanners, scripts, our cache warmer. */
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|scan|curl|wget|python|go-http|http-?client|java\/|libwww|headless|scrapy|axios|fetch|okhttp|facebookexternalhit|preview|semrush|ahrefs|petal|bytespider|zgrab|nuclei|storefront-cache-warm/i

/** True for a crawler, scanner or script; a missing user agent is one too. Cubot phones are not. */
export function looksLikeBot(userAgent: string | null): boolean {
  if (!userAgent?.trim()) return true
  return BOT_UA.test(userAgent.replace(/cubot/gi, ''))
}

/**
 * The cart and sign-in cookies (`cart-cookie.ts` CART_COOKIE, `customer-session.ts`
 * CUSTOMER_COOKIE; both server modules the proxy keeps out): a request carrying one is a shopper.
 */
export const SHOPPER_COOKIES = ['wc_cart', 'wc_customer'] as const

/** A request's place in line: one with our cart or sign-in cookie is a shopper, whatever it says. */
export function renderPriority(userAgent: string | null, shopperCookie: boolean): RenderPriority {
  if (shopperCookie) return PRIORITY.shopper
  return looksLikeBot(userAgent) ? PRIORITY.bot : PRIORITY.visitor
}

type Release = () => void

type Waiter = {
  priority: RenderPriority
  since: number
  resolve: (release: Release) => void
  reject: (error: Error) => void
  signal: AbortSignal | undefined
  onAbort: (() => void) | undefined
}

export type RenderQueueStats = {
  slots: number
  running: number
  queued: number
  queuedBots: number
  /** How long the longest waiter has waited, in ms (0 with nobody waiting). */
  oldestWaitMs: number
}

/** A counting semaphore with a priority queue. `slots` 0 turns it off (everything runs at once). */
export class RenderGate {
  running = 0
  private readonly queue: Waiter[] = []
  private busySince: number | null = null

  constructor(
    readonly slots: number,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Waits for a slot; resolves to its release (call it once, when the work is done). Rejects
   * with `RenderAbortedError` when `signal` aborts first, leaving the line.
   */
  acquire(priority: RenderPriority, signal?: AbortSignal): Promise<Release> {
    if (signal?.aborted) return Promise.reject(new RenderAbortedError())
    if (this.slots <= 0) return Promise.resolve(() => undefined)
    if (this.running < this.slots) {
      this.running++
      return Promise.resolve(this.releaser())
    }
    return new Promise<Release>((resolve, reject) => {
      const waiter: Waiter = {
        priority,
        since: this.now(),
        resolve,
        reject,
        signal,
        onAbort: undefined,
      }
      if (signal) {
        waiter.onAbort = () => {
          this.leave(waiter)
          reject(new RenderAbortedError())
        }
        signal.addEventListener('abort', waiter.onAbort, { once: true })
      }
      // Behind everyone of the same or a better priority, ahead of the rest.
      const at = this.queue.findIndex((w) => w.priority > priority)
      if (at === -1) this.queue.push(waiter)
      else this.queue.splice(at, 0, waiter)
      this.busySince ??= waiter.since
    })
  }

  stats(): RenderQueueStats {
    const now = this.now()
    let oldest = now
    let bots = 0
    for (const w of this.queue) {
      if (w.since < oldest) oldest = w.since
      if (w.priority === PRIORITY.bot) bots++
    }
    return {
      slots: this.slots,
      running: this.running,
      queued: this.queue.length,
      queuedBots: bots,
      oldestWaitMs: now - oldest,
    }
  }

  /** True while someone has waited at least `ms` for a slot. */
  congested(ms: number = BUSY_WAIT_MS): boolean {
    return this.queue.length > 0 && this.stats().oldestWaitMs >= ms
  }

  /** How long the queue has been non-empty without a break, in ms. */
  backedUpForMs(): number {
    return this.busySince === null ? 0 : this.now() - this.busySince
  }

  private releaser(): Release {
    let done = false
    return () => {
      if (done) return
      done = true
      this.running--
      this.next()
    }
  }

  private next() {
    while (this.running < this.slots) {
      const w = this.queue.shift()
      if (!w) break
      if (w.signal && w.onAbort) w.signal.removeEventListener('abort', w.onAbort)
      this.running++
      w.resolve(this.releaser())
    }
    if (this.queue.length === 0) this.busySince = null
  }

  private leave(waiter: Waiter) {
    const at = this.queue.indexOf(waiter)
    if (at !== -1) this.queue.splice(at, 1)
    if (this.queue.length === 0) this.busySince = null
  }
}

/**
 * One request's share of the gate. A page renders several Liquid parts (layout, header, footer,
 * template), some side by side: they share one slot, held while any of them is rendering, so one
 * page never takes the whole gate. The slot goes back when the last part finishes; a part that
 * starts later (a streamed section below the fold) lines up again.
 */
export class RequestSlot {
  private holders = 0
  private held: Promise<Release> | null = null

  constructor(
    private readonly gate: RenderGate,
    readonly priority: RenderPriority,
    readonly signal: AbortSignal | undefined,
  ) {}

  async run<T>(work: (signal: AbortSignal | undefined) => Promise<T>): Promise<T> {
    this.held ??= this.gate.acquire(this.priority, this.signal)
    const held = this.held
    this.holders++
    try {
      await held
      if (this.signal?.aborted) throw new RenderAbortedError()
      return await work(this.signal)
    } finally {
      this.holders--
      if (this.holders === 0 && this.held === held) {
        this.held = null
        held.then(
          (release) => release(),
          () => undefined,
        )
      }
    }
  }
}

type Ticket = { signal: AbortSignal; priority: RenderPriority; at: number }

/**
 * The proxy's note of each page request: its client's abort signal and its place in line. The
 * render finds it by the `x-render-ticket` header; an entry goes when its visitor disconnects or
 * after two minutes.
 */
export class RenderTickets {
  private readonly entries = new Map<string, Ticket>()
  private seq = 0

  constructor(private readonly now: () => number = Date.now) {}

  get size(): number {
    return this.entries.size
  }

  issue(signal: AbortSignal, priority: RenderPriority): string {
    this.sweep()
    const id = String(++this.seq)
    this.entries.set(id, { signal, priority, at: this.now() })
    signal.addEventListener('abort', () => this.entries.delete(id), { once: true })
    return id
  }

  get(id: string): Ticket | undefined {
    return this.entries.get(id)
  }

  private sweep() {
    const cutoff = this.now() - TICKET_TTL_MS
    for (const [id, t] of this.entries) {
      if (t.at >= cutoff && this.entries.size < MAX_TICKETS) break
      this.entries.delete(id)
    }
  }
}

/**
 * The warning to log now, if any: the queue has been backed up for `QUEUE_WARN_MS` and nothing
 * was logged in the last `QUEUE_WARN_EVERY_MS`.
 */
export function queueWarning(
  gate: RenderGate,
  lastWarnAt: number,
  now: number,
): (RenderQueueStats & { backedUpMs: number }) | null {
  const backedUpMs = gate.backedUpForMs()
  if (backedUpMs < QUEUE_WARN_MS || now - lastWarnAt < QUEUE_WARN_EVERY_MS) return null
  return { ...gate.stats(), backedUpMs }
}

type Shared = { gate: RenderGate; tickets: RenderTickets }

const g = globalThis as unknown as { __storefrontRenderGate?: Shared }

/** The process's gate and tickets, made on first use with `STOREFRONT_RENDER_SLOTS` slots. */
export function renderGate(): Shared {
  if (!g.__storefrontRenderGate) {
    const slots = loadEnv(process.env).STOREFRONT_RENDER_SLOTS ?? DEFAULT_RENDER_SLOTS
    g.__storefrontRenderGate = { gate: new RenderGate(slots), tickets: new RenderTickets() }
    watchQueue(g.__storefrontRenderGate.gate)
  }
  return g.__storefrontRenderGate
}

/** The queue's numbers for the memory report, or null before the first page. */
export function renderQueueStats(): RenderQueueStats | null {
  return g.__storefrontRenderGate?.gate.stats() ?? null
}

/** Checks once a second whether the queue is backed up, and warns when it is. */
function watchQueue(gate: RenderGate) {
  let lastWarnAt = 0
  const timer = setInterval(() => {
    const now = Date.now()
    const warning = queueWarning(gate, lastWarnAt, now)
    if (!warning) return
    lastWarnAt = now
    logger.warn('storefront render queue backed up', warning)
  }, 1_000)
  timer.unref?.()
}
