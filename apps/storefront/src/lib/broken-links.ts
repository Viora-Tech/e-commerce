import 'server-only'
import {
  type BrokenLinkHit,
  brokenLinkPath,
  brokenLinkReferrer,
  recordBrokenLinks,
  shouldLogBrokenLink,
} from '@commerce/core'
import { withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { cookies, headers } from 'next/headers'
import { db } from './db'
import { flightOnlyRequest } from './flight-request'
import { isRerender, RERENDER_COOKIE } from './themed-rerender'

/**
 * The 404 log behind Content › Menus › URL redirects › Broken links. A 404 only adds to an
 * in-memory count; one timer per process writes the counts every `FLUSH_MS` as one upsert per
 * store, so a crawler walking dead links costs a map update, not a query. The path never carries
 * a query string and the referrer keeps origin and path only: no PII.
 */

const FLUSH_MS = 30_000

/** Distinct paths buffered between flushes; past it new paths wait for the next window. */
const BUFFER_MAX = 2000

type Pending = Map<string, Map<string, BrokenLinkHit>>

const g = globalThis as unknown as { __brokenLinks?: { pending: Pending; size: number } }

function buffer() {
  g.__brokenLinks ??= { pending: new Map(), size: 0 }
  return g.__brokenLinks
}

let timer: ReturnType<typeof setTimeout> | null = null

/** Write and clear the buffer. Exported for tests. */
export async function flushBrokenLinks(): Promise<void> {
  timer = null
  const state = buffer()
  const pending = state.pending
  state.pending = new Map()
  state.size = 0
  for (const [storeId, paths] of pending) {
    try {
      await withStore(db(), storeId, (tx) => recordBrokenLinks(tx, storeId, [...paths.values()]))
    } catch (err) {
      logger.warn('could not record broken links', { storeId, error: err })
    }
  }
}

/** Count one 404 for `rawPath` (the public path) when it looks like a page someone expected. */
export function noteBrokenLink(storeId: string, rawPath: string, referer: string | null): void {
  if (!shouldLogBrokenLink(rawPath)) return
  const path = brokenLinkPath(rawPath)
  if (!path || path === '/') return
  const state = buffer()
  let paths = state.pending.get(storeId)
  const known = paths?.get(path)
  if (known) {
    known.hits += 1
    known.referrer = brokenLinkReferrer(referer) ?? known.referrer
  } else {
    if (state.size >= BUFFER_MAX) return
    if (!paths) {
      paths = new Map()
      state.pending.set(storeId, paths)
    }
    paths.set(path, { path, hits: 1, referrer: brokenLinkReferrer(referer) })
    state.size += 1
  }
  if (!timer) {
    timer = setTimeout(() => void flushBrokenLinks(), FLUSH_MS)
    timer.unref?.()
  }
}

/**
 * Count this request's 404 (`not-found.tsx`). Only a page load counts: the payload-only answer
 * and the themed reload that follow it (`lib/themed-rerender.ts`) are the same visit.
 */
export async function noteNotFoundRequest(storeId: string): Promise<void> {
  const h = await headers()
  const pathname = h.get('x-pathname') ?? '/'
  if (await flightOnlyRequest()) return
  if (isRerender((await cookies()).get(RERENDER_COOKIE)?.value, pathname)) return
  noteBrokenLink(storeId, pathname, h.get('referer'))
}
