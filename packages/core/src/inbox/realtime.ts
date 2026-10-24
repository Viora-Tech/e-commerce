/** SOURCE OF TRUTH: createInboxHub, inboxStreamResponse, publishInboxEvents, inboxChannels, replayFloorId — WHAT: Inbox realtime over Redis pub/sub and Server-Sent Events: one subscriber connection per process fans messages out to that process's open streams; a stream replays what it missed from Postgres (after `Last-Event-ID`), then goes live with a 20 s `ping` event (EventSource cannot see comments, and the client's watchdog needs a frame); above 2,000 streams or on any failure it answers 503 and the client polls / WHY: no second service, no Postgres connection held per open stream, and pub/sub is only a hint: Postgres is the truth (design §4). Server only. */

/** The structural part of ioredis a subscriber connection needs (core never imports ioredis). */
export type PubSubSubscriber = {
  subscribe(...channels: string[]): Promise<unknown>
  unsubscribe(...channels: string[]): Promise<unknown>
  on(event: 'message', listener: (channel: string, message: string) => void): unknown
}

/** The structural part of ioredis a publisher needs. */
export type PubSubPublisher = {
  publish(channel: string, message: string): Promise<unknown>
}

/** `inbox:{storeId}` carries everything staff see; `conv:{id}` only what that shopper may see. */
export const inboxChannels = {
  store: (storeId: string) => `inbox:${storeId}`,
  conversation: (conversationId: string) => `conv:${conversationId}`,
}

/** One realtime event. `message` events carry the message id as the SSE id (replay cursor). */
export type InboxEvent =
  | { type: 'message'; conversationId: string; message: { id: string } & Record<string, unknown> }
  | { type: 'conversation'; conversationId: string; status?: string; unreadStaff?: number }
  | { type: 'typing'; conversationId: string; sender: 'shopper' | 'staff' }
  | { type: 'seen'; conversationId: string; by: 'shopper' | 'staff'; messageId: string | null }

export type InboxPublish = { channel: string; event: InboxEvent }

/** Sends each event; a publish failure is swallowed (clients catch up by replay or polling). */
export async function publishInboxEvents(
  publisher: PubSubPublisher | undefined,
  events: InboxPublish[],
): Promise<void> {
  if (!publisher) return
  for (const e of events) {
    try {
      await publisher.publish(e.channel, JSON.stringify(e.event))
    } catch {
      // Pub/sub is a hint; the next replay or poll brings the client up to date.
    }
  }
}

type Listener = (event: InboxEvent) => void

export type InboxHub = {
  /** Listens to `channels`; null when this process already holds `maxStreams` streams. */
  open(channels: string[], listener: Listener): Promise<(() => void) | null>
  readonly size: number
}

/**
 * One hub per process over one subscriber connection. Channels are subscribed while at least
 * one stream listens to them and unsubscribed when the last one closes.
 */
export function createInboxHub(
  subscriber: PubSubSubscriber,
  opts: { maxStreams?: number; subscribeTimeoutMs?: number } = {},
): InboxHub {
  const max = opts.maxStreams ?? 2000
  const timeoutMs = opts.subscribeTimeoutMs ?? 3000
  const listeners = new Map<string, Set<Listener>>()
  let streams = 0
  subscriber.on('message', (channel, raw) => {
    const set = listeners.get(channel)
    if (!set || set.size === 0) return
    let event: InboxEvent
    try {
      event = JSON.parse(raw) as InboxEvent
    } catch {
      return
    }
    for (const l of set) {
      try {
        l(event)
      } catch {
        // One broken stream never stops the others.
      }
    }
  })
  return {
    get size() {
      return streams
    },
    async open(channels, listener) {
      if (streams >= max) return null
      streams++
      const fresh: string[] = []
      for (const c of channels) {
        let set = listeners.get(c)
        if (!set) {
          set = new Set()
          listeners.set(c, set)
          fresh.push(c)
        }
        set.add(listener)
      }
      const close = () => {
        streams--
        const gone: string[] = []
        for (const c of channels) {
          const set = listeners.get(c)
          set?.delete(listener)
          if (set && set.size === 0) {
            listeners.delete(c)
            gone.push(c)
          }
        }
        if (gone.length > 0) subscriber.unsubscribe(...gone).catch(() => undefined)
      }
      if (fresh.length > 0) {
        try {
          // Redis down: ioredis would queue the command forever; answer "poll" instead.
          let timer: ReturnType<typeof setTimeout> | undefined
          await Promise.race([
            subscriber.subscribe(...fresh),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('subscribe timed out')), timeoutMs)
            }),
          ]).finally(() => clearTimeout(timer))
        } catch (err) {
          close()
          throw err
        }
      }
      let closed = false
      return () => {
        if (closed) return
        closed = true
        close()
      }
    },
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * The smallest UUIDv7 a message written `overlapMs` before `lastId` could have. Two writes can
 * commit out of id order, so a replay starts a little earlier and the client drops repeats.
 */
export function replayFloorId(lastId: string | null | undefined, overlapMs = 5000): string | null {
  if (!lastId || !UUID.test(lastId)) return null
  const ms = Number.parseInt(lastId.replace(/-/g, '').slice(0, 12), 16) - overlapMs
  const hex = Math.max(0, ms).toString(16).padStart(12, '0')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7000-8000-000000000000`
}

/** One SSE frame. */
export function sseFrame(event: InboxEvent): string {
  const id = event.type === 'message' ? `id: ${event.message.id}\n` : ''
  return `${id}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  // no-transform: proxies (Traefik's compress middleware, Cloudflare) must not buffer or gzip it.
  'Cache-Control': 'no-store, no-transform',
  'X-Accel-Buffering': 'no',
  Connection: 'keep-alive',
}

export type InboxStreamOptions = {
  hub: InboxHub | null
  channels: string[]
  /** `Last-Event-ID` (or `?after=`): the last message the client has. */
  lastEventId: string | null
  /** Messages after the floor id, oldest first (one Postgres query, no connection kept). */
  replay: (floorId: string | null) => Promise<InboxEvent[]>
  /** Drops events this client must not see (the hub delivers whole channels). */
  accept?: (event: InboxEvent) => boolean
  signal?: AbortSignal
  heartbeatMs?: number
}

/** 503 that tells the client to poll instead. */
export const pollInstead = () =>
  new Response('poll', {
    status: 503,
    headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' },
  })

/**
 * The SSE response for one client. Subscribes first and holds live events while the replay
 * runs, so nothing falls between the two; a message seen in both is sent once.
 */
export async function inboxStreamResponse(opts: InboxStreamOptions): Promise<Response> {
  const { hub } = opts
  if (!hub) return pollInstead()
  const accept = opts.accept ?? (() => true)
  const encoder = new TextEncoder()
  let push: (event: InboxEvent) => void = () => undefined
  const held: InboxEvent[] = []
  let live = false
  let close: (() => void) | null
  try {
    close = await hub.open(opts.channels, (event) => {
      if (!accept(event)) return
      if (live) push(event)
      else held.push(event)
    })
  } catch {
    return pollInstead()
  }
  if (!close) return pollInstead()
  const stop = close
  let timer: ReturnType<typeof setInterval> | undefined
  const sent = new Set<string>()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let done = false
      const end = () => {
        if (done) return
        done = true
        if (timer) clearInterval(timer)
        stop()
        try {
          controller.close()
        } catch {
          // already closed by the client
        }
      }
      const write = (text: string) => {
        if (done) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          end()
        }
      }
      push = (event) => {
        if (event.type === 'message') {
          if (sent.has(event.message.id)) return
          sent.add(event.message.id)
        }
        write(sseFrame(event))
      }
      opts.signal?.addEventListener('abort', end, { once: true })
      write('retry: 3000\nevent: ready\ndata: {}\n\n')
      try {
        for (const e of await opts.replay(replayFloorId(opts.lastEventId))) if (accept(e)) push(e)
      } catch {
        // The live stream still works; the client's next poll or reconnect replays.
      }
      for (const e of held.splice(0)) push(e)
      live = true
      timer = setInterval(() => write('event: ping\ndata: {}\n\n'), opts.heartbeatMs ?? 20_000)
    },
    cancel() {
      if (timer) clearInterval(timer)
      stop()
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}

const g = globalThis as { __commerceInboxHub?: InboxHub }

/** The process's hub, made on first use (survives dev reloads). */
export function processInboxHub(makeSubscriber: () => PubSubSubscriber): InboxHub {
  if (!g.__commerceInboxHub) g.__commerceInboxHub = createInboxHub(makeSubscriber())
  return g.__commerceInboxHub
}
