/** SOURCE OF TRUTH: storefront render queue — WHAT: slots, priorities, aborts, the busy signal / WHY: a bot scan froze the storefront on 26 Nov 2026 */
import { describe, expect, it } from 'vitest'
import {
  BUSY_WAIT_MS,
  looksLikeBot,
  PRIORITY,
  QUEUE_WARN_MS,
  queueWarning,
  RenderAbortedError,
  RenderGate,
  RenderTickets,
  RequestSlot,
  renderPriority,
} from './render-gate'

/** A clock the test moves by hand. */
function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, tick: (ms: number) => (t += ms) }
}

/** Lets resolved promises run their callbacks. */
const flush = () => new Promise((r) => setTimeout(r, 0))

/** A piece of work the test finishes by hand. */
function deferred() {
  let done!: () => void
  const promise = new Promise<void>((r) => {
    done = r
  })
  return { promise, done }
}

describe('looksLikeBot', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)',
    'curl/8.4.0',
    'python-requests/2.31.0',
    'Go-http-client/1.1',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36',
    'facebookexternalhit/1.1',
    'storefront-cache-warm',
    '',
  ])('treats %j as a bot', (ua) => {
    expect(looksLikeBot(ua)).toBe(true)
  })

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  ])('treats %j as a person', (ua) => {
    expect(looksLikeBot(ua)).toBe(false)
  })

  it('puts a request with our cart or sign-in cookie first, even with a bot-like agent', () => {
    expect(renderPriority('curl/8.4.0', true)).toBe(PRIORITY.shopper)
    expect(renderPriority('Mozilla/5.0 (iPhone) Safari/604.1', false)).toBe(PRIORITY.visitor)
    expect(renderPriority('Googlebot/2.1', false)).toBe(PRIORITY.bot)
  })
})

describe('RenderGate', () => {
  it('runs up to its slots at once and queues the rest', async () => {
    const gate = new RenderGate(2)
    const a = await gate.acquire(PRIORITY.visitor)
    await gate.acquire(PRIORITY.visitor)
    let third = false
    const waiting = gate.acquire(PRIORITY.visitor).then((r) => {
      third = true
      return r
    })
    await flush()
    expect(third).toBe(false)
    expect(gate.stats()).toMatchObject({ running: 2, queued: 1 })
    a()
    await waiting
    expect(third).toBe(true)
    expect(gate.stats()).toMatchObject({ running: 2, queued: 0 })
  })

  it('lets shoppers through first and crawlers last, in arrival order within each', async () => {
    const gate = new RenderGate(1)
    const first = await gate.acquire(PRIORITY.visitor)
    const order: string[] = []
    const line = [
      ['bot-1', PRIORITY.bot],
      ['visitor-1', PRIORITY.visitor],
      ['bot-2', PRIORITY.bot],
      ['shopper-1', PRIORITY.shopper],
      ['visitor-2', PRIORITY.visitor],
      ['shopper-2', PRIORITY.shopper],
    ] as const
    const all = line.map(([name, p]) =>
      gate.acquire(p).then((release) => {
        order.push(name)
        release()
      }),
    )
    first()
    await Promise.all(all)
    expect(order).toEqual(['shopper-1', 'shopper-2', 'visitor-1', 'visitor-2', 'bot-1', 'bot-2'])
    expect(gate.stats()).toMatchObject({ running: 0, queued: 0 })
  })

  it('drops a waiter whose visitor left, and never gives it a slot', async () => {
    const gate = new RenderGate(1)
    const held = await gate.acquire(PRIORITY.visitor)
    const left = new AbortController()
    const gone = gate.acquire(PRIORITY.bot, left.signal)
    const next = gate.acquire(PRIORITY.bot)
    left.abort()
    await expect(gone).rejects.toBeInstanceOf(RenderAbortedError)
    expect(gate.stats().queued).toBe(1)
    held()
    ;(await next)()
    expect(gate.stats()).toMatchObject({ running: 0, queued: 0 })
  })

  it('refuses at once a visitor already gone', async () => {
    const gate = new RenderGate(1)
    await expect(gate.acquire(PRIORITY.visitor, AbortSignal.abort())).rejects.toBeInstanceOf(
      RenderAbortedError,
    )
    expect(gate.stats().running).toBe(0)
  })

  it('counts a release once, however often it is called', async () => {
    const gate = new RenderGate(1)
    const release = await gate.acquire(PRIORITY.visitor)
    release()
    release()
    expect(gate.stats().running).toBe(0)
  })

  it('with 0 slots never queues', async () => {
    const gate = new RenderGate(0)
    for (let i = 0; i < 10; i++) await gate.acquire(PRIORITY.bot)
    expect(gate.stats()).toMatchObject({ running: 0, queued: 0 })
  })

  it('is congested once someone has waited 5 s, and not before', async () => {
    const c = clock()
    const gate = new RenderGate(1, c.now)
    const held = await gate.acquire(PRIORITY.visitor)
    expect(gate.congested()).toBe(false)
    const waiting = gate.acquire(PRIORITY.visitor)
    c.tick(BUSY_WAIT_MS - 1)
    expect(gate.congested()).toBe(false)
    c.tick(1)
    expect(gate.congested()).toBe(true)
    expect(gate.stats().oldestWaitMs).toBe(BUSY_WAIT_MS)
    held()
    ;(await waiting)()
    expect(gate.congested()).toBe(false)
  })

  it('warns once the queue stays backed up, then at most every 30 s', async () => {
    const c = clock()
    const gate = new RenderGate(1, c.now)
    await gate.acquire(PRIORITY.visitor)
    void gate.acquire(PRIORITY.bot)
    expect(queueWarning(gate, 0, c.now())).toBeNull()
    c.tick(QUEUE_WARN_MS)
    const warning = queueWarning(gate, 0, c.now())
    expect(warning).toMatchObject({ running: 1, queued: 1, queuedBots: 1 })
    expect(warning?.backedUpMs).toBe(QUEUE_WARN_MS)
    expect(queueWarning(gate, c.now(), c.now() + 1_000)).toBeNull()
  })
})

describe('RequestSlot', () => {
  it("shares one slot between a page's parts rendering side by side", async () => {
    const gate = new RenderGate(1)
    const slot = new RequestSlot(gate, PRIORITY.visitor, undefined)
    const header = deferred()
    const footer = deferred()
    const both = Promise.all([slot.run(() => header.promise), slot.run(() => footer.promise)])
    await flush()
    expect(gate.stats()).toMatchObject({ running: 1, queued: 0 })
    header.done()
    await flush()
    expect(gate.stats().running).toBe(1)
    footer.done()
    await both
    await flush()
    expect(gate.stats().running).toBe(0)
  })

  it('lets four pages render at once and queues the fifth', async () => {
    const gate = new RenderGate(4)
    const pages = Array.from({ length: 5 }, () => ({
      slot: new RequestSlot(gate, PRIORITY.visitor, undefined),
      work: deferred(),
    }))
    const runs = pages.map((p) => p.slot.run(() => p.work.promise))
    await flush()
    expect(gate.stats()).toMatchObject({ running: 4, queued: 1 })
    for (const p of pages) p.work.done()
    await Promise.all(runs)
    await flush()
    expect(gate.stats()).toMatchObject({ running: 0, queued: 0 })
  })

  it('gives the slot back when the work throws', async () => {
    const gate = new RenderGate(1)
    const slot = new RequestSlot(gate, PRIORITY.visitor, undefined)
    await expect(slot.run(() => Promise.reject(new Error('liquid')))).rejects.toThrow('liquid')
    await flush()
    expect(gate.stats().running).toBe(0)
  })

  it('never starts the work of a visitor who left while waiting', async () => {
    const gate = new RenderGate(1)
    const held = await gate.acquire(PRIORITY.visitor)
    const left = new AbortController()
    const slot = new RequestSlot(gate, PRIORITY.bot, left.signal)
    let ran = false
    const run = slot.run(async () => {
      ran = true
    })
    left.abort()
    await expect(run).rejects.toBeInstanceOf(RenderAbortedError)
    held()
    await flush()
    expect(ran).toBe(false)
    expect(gate.stats()).toMatchObject({ running: 0, queued: 0 })
  })

  it('hands the work its signal, to stop between sections', async () => {
    const gate = new RenderGate(1)
    const left = new AbortController()
    const slot = new RequestSlot(gate, PRIORITY.visitor, left.signal)
    const seen = await slot.run(async (signal) => signal)
    expect(seen).toBe(left.signal)
  })
})

describe('RenderTickets', () => {
  it('finds a request by its ticket until its visitor disconnects', () => {
    const tickets = new RenderTickets()
    const req = new AbortController()
    const id = tickets.issue(req.signal, PRIORITY.bot)
    expect(tickets.get(id)).toMatchObject({ priority: PRIORITY.bot, signal: req.signal })
    req.abort()
    expect(tickets.get(id)).toBeUndefined()
  })

  it('drops tickets older than two minutes as new ones come in', () => {
    const c = clock()
    const tickets = new RenderTickets(c.now)
    const old = tickets.issue(new AbortController().signal, PRIORITY.visitor)
    c.tick(2 * 60_000 + 1)
    const fresh = tickets.issue(new AbortController().signal, PRIORITY.visitor)
    expect(tickets.get(old)).toBeUndefined()
    expect(tickets.get(fresh)).toBeDefined()
    expect(tickets.size).toBe(1)
  })
})
