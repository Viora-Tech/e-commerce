/** SOURCE OF TRUTH: Inbox realtime tests — WHAT: the hub's fan-out over one fake Redis subscriber, subscribe/unsubscribe by reference, the stream cap, the SSE response (replay from Last-Event-ID, then live, each message once), 503 then polling, and the browser connection's fallback to polling / WHY: a dropped or buffered stream must never lose a reply */
import { describe, expect, it } from 'vitest'
import { connectInbox, type EventSourceLike, type InboxConnectionEvent } from './connection'
import {
  createInboxHub,
  type InboxEvent,
  inboxStreamResponse,
  type PubSubSubscriber,
  replayFloorId,
  sseFrame,
} from './realtime'

function fakeRedis() {
  let onMessage: (channel: string, message: string) => void = () => undefined
  const subscribed = new Set<string>()
  const calls: string[] = []
  const sub: PubSubSubscriber = {
    async subscribe(...channels) {
      for (const c of channels) subscribed.add(c)
      calls.push(`sub ${channels.join(',')}`)
    },
    async unsubscribe(...channels) {
      for (const c of channels) subscribed.delete(c)
      calls.push(`unsub ${channels.join(',')}`)
    },
    on(_event, listener) {
      onMessage = listener
    },
  }
  return {
    sub,
    subscribed,
    calls,
    publish: (channel: string, event: InboxEvent) => {
      if (subscribed.has(channel)) onMessage(channel, JSON.stringify(event))
    },
  }
}

const message = (id: string, body = 'hi'): InboxEvent => ({
  type: 'message',
  conversationId: 'c1',
  message: { id, body },
})

/** Reads SSE frames from a response body until `count` frames arrived. */
async function frames(res: Response, count: number): Promise<string[]> {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (text.split('\n\n').filter(Boolean).length < count) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value)
  }
  await reader.cancel()
  return text.split('\n\n').filter(Boolean)
}

describe('inbox hub', () => {
  it('fans one Redis message out to every stream on the channel', async () => {
    const redis = fakeRedis()
    const hub = createInboxHub(redis.sub)
    const a: InboxEvent[] = []
    const b: InboxEvent[] = []
    const closeA = await hub.open(['inbox:s1'], (e) => a.push(e))
    const closeB = await hub.open(['inbox:s1', 'conv:c1'], (e) => b.push(e))
    expect(redis.calls).toEqual(['sub inbox:s1', 'sub conv:c1'])
    redis.publish('inbox:s1', message('m1'))
    redis.publish('conv:c1', message('m2'))
    expect(a.map((e) => e.type === 'message' && e.message.id)).toEqual(['m1'])
    expect(b.map((e) => e.type === 'message' && e.message.id)).toEqual(['m1', 'm2'])
    expect(hub.size).toBe(2)
    closeA?.()
    expect(redis.subscribed.has('inbox:s1')).toBe(true)
    closeB?.()
    closeB?.()
    expect(redis.subscribed.size).toBe(0)
    expect(hub.size).toBe(0)
  })

  it('refuses a stream past the cap', async () => {
    const hub = createInboxHub(fakeRedis().sub, { maxStreams: 1 })
    expect(await hub.open(['a'], () => undefined)).not.toBeNull()
    expect(await hub.open(['b'], () => undefined)).toBeNull()
  })

  it('ignores a broken payload and a throwing listener', async () => {
    const redis = fakeRedis()
    const hub = createInboxHub(redis.sub)
    const got: InboxEvent[] = []
    await hub.open(['x'], () => {
      throw new Error('boom')
    })
    await hub.open(['x'], (e) => got.push(e))
    redis.publish('x', message('m1'))
    expect(got).toHaveLength(1)
  })
})

describe('replay floor', () => {
  it('starts 5 seconds before the last id, and ignores anything that is not a UUIDv7', () => {
    const last = '01a16ee0-2037-74a4-8c8a-43cd541996c5'
    const floor = replayFloorId(last) as string
    const ms = (id: string) => Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16)
    expect(ms(last) - ms(floor)).toBe(5000)
    expect(floor < last).toBe(true)
    expect(replayFloorId('not-an-id')).toBeNull()
    expect(replayFloorId(null)).toBeNull()
  })
})

describe('inbox stream response', () => {
  it('replays after Last-Event-ID, then goes live, sending each message once', async () => {
    const redis = fakeRedis()
    const hub = createInboxHub(redis.sub)
    let release: () => void = () => undefined
    const gate = new Promise<void>((r) => {
      release = r
    })
    const res = await inboxStreamResponse({
      hub,
      channels: ['conv:c1'],
      lastEventId: '01a16ee0-2037-74a4-8c8a-43cd541996c5',
      replay: async (floor) => {
        expect(floor).not.toBeNull()
        await gate
        return [message('m2'), message('m3')]
      },
      heartbeatMs: 60_000,
    })
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('cache-control')).toContain('no-transform')
    expect(res.headers.get('x-accel-buffering')).toBe('no')
    // Arrives while the replay runs: held, then sent once.
    redis.publish('conv:c1', message('m3'))
    redis.publish('conv:c1', message('m4'))
    release()
    const got = await frames(res, 4)
    expect(got[0]).toContain('event: ready')
    expect(got.slice(1).map((f) => /^id: (\S+)/.exec(f)?.[1])).toEqual(['m2', 'm3', 'm4'])
  })

  it('drops events the client must not see', async () => {
    const redis = fakeRedis()
    const hub = createInboxHub(redis.sub)
    const res = await inboxStreamResponse({
      hub,
      channels: ['conv:c1'],
      lastEventId: null,
      replay: async () => [],
      accept: (e) => e.type !== 'typing',
      heartbeatMs: 60_000,
    })
    redis.publish('conv:c1', { type: 'typing', conversationId: 'c1', sender: 'staff' })
    redis.publish('conv:c1', message('m1'))
    const got = await frames(res, 2)
    expect(got[1]).toContain('id: m1')
  })

  it('answers 503 (poll instead) without a hub or past the cap', async () => {
    const replay = async () => []
    expect(
      (await inboxStreamResponse({ hub: null, channels: [], lastEventId: null, replay })).status,
    ).toBe(503)
    const hub = createInboxHub(fakeRedis().sub, { maxStreams: 0 })
    expect(
      (await inboxStreamResponse({ hub, channels: ['a'], lastEventId: null, replay })).status,
    ).toBe(503)
  })

  it('frames carry the message id only for messages', () => {
    expect(sseFrame(message('m1'))).toMatch(/^id: m1\nevent: message\ndata: /)
    expect(sseFrame({ type: 'seen', conversationId: 'c', by: 'staff', messageId: null })).toMatch(
      /^event: seen\n/,
    )
  })
})

/** A hand-driven clock and EventSource. */
function harness(opts: { active?: () => boolean } = {}) {
  let now = 0
  const queue: { at: number; fn: () => void; id: number }[] = []
  let nextId = 1
  const timers = {
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextId++
      queue.push({ at: now + ms, fn, id })
      return id
    },
    clearTimeout: (id: unknown) => {
      const i = queue.findIndex((t) => t.id === id)
      if (i >= 0) queue.splice(i, 1)
    },
  }
  const advance = async (ms: number) => {
    const end = now + ms
    for (;;) {
      queue.sort((a, b) => a.at - b.at)
      const next = queue[0]
      if (!next || next.at > end) break
      queue.shift()
      now = next.at
      next.fn()
      await Promise.resolve()
      await Promise.resolve()
    }
    now = end
  }
  const sources: (Omit<EventSourceLike, 'onerror' | 'onopen'> & {
    onerror: ((e: unknown) => void) | null
    onopen: ((e: unknown) => void) | null
    url: string
    emit: (type: string, data: unknown) => void
    closed: boolean
    readyState: number
  })[] = []
  const events: InboxConnectionEvent[] = []
  const polls: (string | null)[] = []
  const modes: string[] = []
  let pollAnswer: InboxConnectionEvent[] = []
  const conn = connectInbox({
    streamUrl: (after) => `/stream?after=${after ?? ''}`,
    poll: async (after) => {
      polls.push(after)
      const out = pollAnswer
      pollAnswer = []
      return out
    },
    onEvent: (e) => events.push(e),
    onMode: (m) => modes.push(m),
    isActive: opts.active,
    timers,
    createEventSource: (url) => {
      const listeners = new Map<string, ((e: { data?: string }) => void)[]>()
      const es = {
        url,
        closed: false,
        readyState: 1,
        onerror: null as ((e: unknown) => void) | null,
        onopen: null as ((e: unknown) => void) | null,
        addEventListener: (type: string, l: (e: { data?: string }) => void) => {
          listeners.set(type, [...(listeners.get(type) ?? []), l])
        },
        close: () => {
          es.closed = true
        },
        emit: (type: string, data: unknown) => {
          for (const l of listeners.get(type) ?? []) l({ data: JSON.stringify(data) })
        },
      }
      sources.push(es)
      return es
    },
  })
  return {
    conn,
    sources,
    events,
    polls,
    modes,
    advance,
    answer: (e: InboxConnectionEvent[]) => {
      pollAnswer = e
    },
  }
}

const msg = (id: string): InboxConnectionEvent => ({ type: 'message', message: { id } })

describe('browser connection', () => {
  it('keeps streaming while frames arrive, and passes each message on once', async () => {
    const h = harness()
    const es = h.sources[0]
    es?.emit('ready', {})
    es?.emit('message', msg('m1'))
    es?.emit('message', msg('m1'))
    await h.advance(25_000)
    es?.emit('ping', {})
    await h.advance(25_000)
    expect(h.conn.mode()).toBe('stream')
    expect(h.events).toEqual([msg('m1')])
  })

  it('polls every 4 s when no frame arrives within 10 s, from the last message it has', async () => {
    const h = harness()
    h.sources[0]?.emit('message', msg('m1'))
    await h.advance(30_001)
    expect(h.conn.mode()).toBe('poll')
    expect(h.sources[0]?.closed).toBe(true)
    h.answer([msg('m1'), msg('m2')])
    await h.advance(4_000)
    await h.advance(4_000)
    expect(h.polls[0]).toBe('m1')
    expect(h.polls.at(-1)).toBe('m2')
    expect(h.events).toEqual([msg('m1'), msg('m2')])
  })

  it('falls back after 3 errors in a row, or at once when the server refused (503)', async () => {
    const h = harness()
    const es = h.sources[0]
    es?.onerror?.({})
    es?.onerror?.({})
    expect(h.conn.mode()).toBe('stream')
    es?.onerror?.({})
    expect(h.conn.mode()).toBe('poll')

    const refused = harness()
    const first = refused.sources[0]
    if (first) first.readyState = 2
    first?.onerror?.({})
    expect(refused.conn.mode()).toBe('poll')
  })

  it('polls only while active, and tries the stream again after 5 minutes', async () => {
    let visible = false
    const h = harness({ active: () => visible })
    await h.advance(11_000)
    await h.advance(12_000)
    expect(h.polls).toEqual([])
    visible = true
    await h.advance(4_000)
    expect(h.polls.length).toBeGreaterThan(0)
    // Polling began at 10 s; the stream is tried again at 310 s (now 27 s).
    await h.advance(284_000)
    expect(h.conn.mode()).toBe('stream')
    expect(h.sources).toHaveLength(2)
    expect(h.modes).toEqual(['poll', 'stream'])
    h.conn.close()
    expect(h.sources[1]?.closed).toBe(true)
  })
})
