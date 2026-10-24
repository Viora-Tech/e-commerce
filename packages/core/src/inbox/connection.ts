/** SOURCE OF TRUTH: connectInbox — WHAT: the browser side of Inbox realtime, shared by the admin inbox and the storefront widget: an EventSource on the stream, with a watchdog that switches to polling when no frame (event or ping) arrives within 10 s of the expected heartbeat, after 3 errors in a row, or when the server answers 503; polling runs every 4 s while the tab is visible and tries the stream again every 5 minutes / WHY: SSE through Cloudflare and Traefik usually works, but a buffering proxy or a full process must never leave a shopper without replies (design §4). Pure: no DOM globals are touched unless passed in. */

/** The parts of EventSource this needs (so tests pass a fake). */
export type EventSourceLike = {
  addEventListener(type: string, listener: (e: { data?: string }) => void): void
  close(): void
  onerror: ((e: unknown) => void) | null
  onopen: ((e: unknown) => void) | null
  /** 2 = CLOSED: the server refused (503) and the browser will not retry. */
  readonly readyState?: number
}

export type InboxConnectionEvent = { type: string; [key: string]: unknown }

export type ConnectInboxOptions = {
  /** The stream URL, given the last message id the client holds (for `?after=`). */
  streamUrl: (afterId: string | null) => string
  /** One poll: the events since `afterId`, oldest first. */
  poll: (afterId: string | null) => Promise<InboxConnectionEvent[]>
  onEvent: (event: InboxConnectionEvent) => void
  onMode?: (mode: 'stream' | 'poll') => void
  createEventSource: (url: string) => EventSourceLike
  /** Polls only while this is true (tab visible, widget open). */
  isActive?: (() => boolean) | undefined
  initialAfterId?: string | null
  heartbeatMs?: number
  graceMs?: number
  pollMs?: number
  retryStreamMs?: number
  timers?: {
    setTimeout: (fn: () => void, ms: number) => unknown
    clearTimeout: (id: unknown) => void
  }
}

export const EVENT_TYPES = ['message', 'conversation', 'typing', 'seen', 'ping', 'ready'] as const

/** Opens the connection; returns `close`. Messages are passed on once each (by id). */
export function connectInbox(opts: ConnectInboxOptions): { close: () => void; mode: () => string } {
  const timers = opts.timers ?? {
    setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id: unknown) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  }
  const heartbeat = opts.heartbeatMs ?? 20_000
  const grace = opts.graceMs ?? 10_000
  const pollMs = opts.pollMs ?? 4_000
  const retryStreamMs = opts.retryStreamMs ?? 5 * 60_000
  const active = opts.isActive ?? (() => true)
  let lastId = opts.initialAfterId ?? null
  const seen = new Set<string>()
  let mode: 'stream' | 'poll' = 'stream'
  let source: EventSourceLike | null = null
  let watchdog: unknown = null
  let pollTimer: unknown = null
  let retryTimer: unknown = null
  let errors = 0
  let closed = false

  const deliver = (event: InboxConnectionEvent) => {
    if (event.type === 'message') {
      const id = (event.message as { id?: string } | undefined)?.id
      if (!id || seen.has(id)) return
      seen.add(id)
      if (!lastId || id > lastId) lastId = id
    }
    opts.onEvent(event)
  }

  const arm = (ms: number) => {
    if (watchdog) timers.clearTimeout(watchdog)
    watchdog = timers.setTimeout(() => switchToPoll(), ms)
  }

  const stopStream = () => {
    if (watchdog) timers.clearTimeout(watchdog)
    watchdog = null
    source?.close()
    source = null
  }

  const pollOnce = async () => {
    if (closed || mode !== 'poll') return
    if (active()) {
      try {
        for (const e of await opts.poll(lastId)) deliver(e)
      } catch {
        // Try again on the next tick.
      }
    }
    if (!closed && mode === 'poll') pollTimer = timers.setTimeout(pollOnce, pollMs)
  }

  function switchToPoll() {
    if (closed || mode === 'poll') return
    stopStream()
    mode = 'poll'
    opts.onMode?.('poll')
    pollTimer = timers.setTimeout(pollOnce, 0)
    retryTimer = timers.setTimeout(() => {
      if (closed) return
      if (pollTimer) timers.clearTimeout(pollTimer)
      mode = 'stream'
      opts.onMode?.('stream')
      openStream()
    }, retryStreamMs)
  }

  function openStream() {
    errors = 0
    const es = opts.createEventSource(opts.streamUrl(lastId))
    source = es
    arm(grace)
    const frame = () => {
      errors = 0
      arm(heartbeat + grace)
    }
    for (const type of EVENT_TYPES) {
      es.addEventListener(type, (e) => {
        frame()
        if (type === 'ping' || type === 'ready') return
        try {
          deliver(JSON.parse(e.data ?? '{}') as InboxConnectionEvent)
        } catch {
          // A broken frame is skipped.
        }
      })
    }
    es.onopen = () => frame()
    es.onerror = () => {
      errors++
      // EventSource reconnects by itself (with Last-Event-ID); three failures in a row, or a
      // 503 (which closes it for good), mean the stream is not getting through.
      if (errors >= 3 || es.readyState === 2) switchToPoll()
    }
  }

  openStream()
  return {
    close: () => {
      closed = true
      stopStream()
      if (pollTimer) timers.clearTimeout(pollTimer)
      if (retryTimer) timers.clearTimeout(retryTimer)
    },
    mode: () => mode,
  }
}
