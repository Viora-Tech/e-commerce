/**
 * Shopify Admin Bulk Operations: run a query over a whole resource (products,
 * customers, orders) without paying the per-page calculated-cost tax that
 * throttles `ShopifyClient.paginate`. Bulk queries run asynchronously on
 * Shopify's side and answer with a JSONL file instead of a normal response.
 *
 * Shapes and limits verified against shopify.dev on 2026-10-31, API version
 * 2026-10 (this package's `SHOPIFY_API_VERSION`):
 *  - https://shopify.dev/docs/api/usage/bulk-operations/queries
 *    - Poll `bulkOperation(id:) { id status errorCode url partialDataUrl }`
 *      ("In API version 2026-01 and higher, use the bulkOperation(id:) query").
 *      `currentBulkOperation` is deprecated ("Use bulkOperations with status
 *      filter instead"), so it is no longer asked.
 *    - From 2026-01 an app can run up to five bulk queries per shop at once, so
 *      another one running (an earlier import) no longer blocks this one.
 *    - The query string uses the normal `edges { node { ... } }` connection
 *      shape; no pagination arguments (`first`/`after`) are allowed inside it.
 *    - At most 5 connections total and 2 levels of nested connections.
 *    - Result is JSONL at `url` (signed, expires after a week): one node per
 *      line; a nested connection's children are flattened onto their own
 *      lines with `__parentId` pointing back at the parent's `id`, and
 *      `__parentId` never appears in the schema itself.
 *    - An operation can take up to 10 days; Shopify recommends polling less
 *      often for bigger shops (their example: about once a minute, not once
 *      every 10 seconds).
 *  - https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/bulkOperationRunQuery
 *    - `bulkOperationRunQuery(query: String!, groupObjects: Boolean! = false)`.
 *      The default changed from true to false in 2026-01 (a breaking change in
 *      the changelog). Ungrouped output no longer promises a record's children
 *      sit right after it, which `streamBulkRoots` relies on, so every run asks
 *      for `groupObjects: true` (Shopify warns it is slower; correctness first).
 */
import type { ShopifyClient } from './shopify-client'

export class BulkUnavailableError extends Error {}

type BulkStatus = 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'CANCELING'

type BulkOperation = {
  id: string
  status: BulkStatus
  errorCode: string | null
  url: string | null
  partialDataUrl: string | null
} | null

const BULK_OPERATION_QUERY = `query BulkOperation($id: ID!) {
  bulkOperation(id: $id) {
    id status errorCode url partialDataUrl
  }
}`

const RUN_QUERY_MUTATION = `mutation RunBulkQuery($query: String!) {
  bulkOperationRunQuery(query: $query, groupObjects: true) {
    bulkOperation { id status }
    userErrors { field message }
  }
}`

export type BulkPollOptions = {
  /** Overridable in tests; production defaults to something well within Shopify's own guidance. */
  intervalMs?: number
  maxPolls?: number
}

async function bulkOperation(client: ShopifyClient, id: string): Promise<BulkOperation> {
  const data = await client.query<{ bulkOperation?: BulkOperation }>(
    BULK_OPERATION_QUERY,
    { id },
    1,
  )
  return data.bulkOperation ?? null
}

/**
 * Submit `query` (a bulk-shaped query string, `edges { node { ... } }`, no
 * pagination args) and poll our own operation until it finishes. Throws
 * `BulkUnavailableError` for anything the caller should treat as "fall back to
 * paged fetching": Shopify refusing the query (including too many bulk
 * operations running at once), or the operation itself failing.
 */
export async function runBulkQuery(
  client: ShopifyClient,
  query: string,
  opts: BulkPollOptions = {},
): Promise<string | null> {
  const started = await client.query<{
    bulkOperationRunQuery?: {
      bulkOperation: { id: string; status: BulkStatus } | null
      userErrors: { field: string[] | null; message: string }[]
    } | null
  }>(RUN_QUERY_MUTATION, { query }, 10)
  const payload = started.bulkOperationRunQuery
  if (!payload) throw new BulkUnavailableError('Shopify did not start the bulk operation')
  if (payload.userErrors.length > 0) {
    throw new BulkUnavailableError(payload.userErrors.map((e) => e.message).join('; '))
  }
  const created = payload.bulkOperation
  if (!created) throw new BulkUnavailableError('Shopify did not start the bulk operation')

  const intervalMs = opts.intervalMs ?? 1500
  const maxPolls = opts.maxPolls ?? 400
  for (let poll = 0; poll < maxPolls; poll++) {
    const op = await bulkOperation(client, created.id)
    if (!op || op.id !== created.id)
      throw new BulkUnavailableError('Lost track of the bulk operation')
    if (op.status === 'COMPLETED') return op.url
    if (op.status === 'FAILED' || op.status === 'CANCELED' || op.status === 'CANCELING') {
      throw new BulkUnavailableError(op.errorCode ?? `Bulk operation ${op.status.toLowerCase()}`)
    }
    await client.wait(intervalMs)
  }
  throw new BulkUnavailableError('Timed out waiting for the bulk operation')
}

/** Download the JSONL result and yield one parsed record per line. Empty/blank lines are skipped. */
export async function* streamJsonl(
  url: string,
  fetchImpl: typeof fetch,
): AsyncGenerator<Record<string, unknown>> {
  const res = await fetchImpl(url)
  if (!res.ok) throw new BulkUnavailableError(`Could not download the bulk result (${res.status})`)
  const body = res.body
  if (body && typeof body.getReader === 'function' && typeof TextDecoder !== 'undefined') {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (value) buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) yield JSON.parse(line) as Record<string, unknown>
        newline = buffer.indexOf('\n')
      }
      if (done) break
    }
    const rest = buffer.trim()
    if (rest) yield JSON.parse(rest) as Record<string, unknown>
    return
  }
  // No streaming body (some fakes in tests): fall back to reading it all at once.
  const text = await res.text()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed) yield JSON.parse(trimmed) as Record<string, unknown>
  }
}

/** `gid://shopify/ProductVariant/123` -> `ProductVariant`. */
function gidType(id: string): string {
  return id.split('/')[3] ?? ''
}

type ChildMapping = { field: string; asPage: boolean }

type RawNode = { id: string; __parentId?: string } & Record<string, unknown>
type WithChildren = RawNode & { __children: Map<string, WithChildren[]> }

export type ChildMappingOf = (gidType: string) => ChildMapping | null

/**
 * Reassemble a bulk-operation JSONL stream into the same nested shape a paged
 * query would have produced (`{ nodes: [...] }` or, for a field that pairs
 * with a `hasNextPage` check elsewhere, `{ pageInfo, nodes: [...] }`), so the
 * existing `map*` functions in `shopify-api.ts` can read either, and hand the
 * records on `size` at a time while the download is still streaming.
 *
 * `childFieldOf` says which field name (and shape) a child's GID type maps to
 * on its parent, e.g. `ProductVariant -> variants` (paged) or
 * `MediaImage -> media` (plain `nodes`). Types with no mapping are dropped.
 *
 * Memory stays at one top-level record plus one batch, never the whole file:
 * Shopify writes every nested record after its parent ("all nested connections
 * appear after their parents") and in practice before the next top-level
 * record, so a record is complete when the next one starts. A nested record
 * that turns up after its parent was already handed on would be lost, so the
 * read stops with `BulkUnavailableError` instead of importing a record without
 * its lines.
 */
export async function* streamBulkRoots<T>(
  lines: AsyncGenerator<Record<string, unknown>>,
  childFieldOf: ChildMappingOf,
  /**
   * Connections that must be present even when empty (a product with no
   * images has zero `MediaImage` lines, but callers still expect `media.nodes`).
   */
  connectionDefaults: ChildMapping[] = [],
  size = 50,
): AsyncGenerator<T[]> {
  /** The current top-level record and everything nested under it so far, by id. */
  let group: Map<string, WithChildren> | null = null
  let rootId: string | null = null
  /** Ids of records already handed on (ids only, to catch an out-of-order child). */
  const done = new Set<string>()
  let batch: T[] = []

  const attach = (node: WithChildren): unknown => {
    const out: Record<string, unknown> = { ...node }
    delete out.__children
    delete out.__parentId
    for (const d of connectionDefaults) {
      out[d.field] = d.asPage
        ? { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] }
        : { nodes: [] }
    }
    // Several child types can share one field (BasicEvent and CommentEvent are both `events`).
    const filled = new Set<string>()
    for (const [type, children] of node.__children) {
      const mapping = childFieldOf(type)
      if (!mapping) continue
      const mapped = children.map((c) => attach(c))
      const before = filled.has(mapping.field)
        ? ((out[mapping.field] as { nodes: unknown[] }).nodes ?? [])
        : []
      filled.add(mapping.field)
      out[mapping.field] = mapping.asPage
        ? { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [...before, ...mapped] }
        : { nodes: [...before, ...mapped] }
    }
    return out
  }
  const finish = () => {
    if (!group || !rootId) return
    const root = group.get(rootId)
    if (root) batch.push(attach(root) as T)
    for (const id of group.keys()) done.add(id)
    group = null
    rootId = null
  }

  for await (const raw of lines) {
    const node = raw as RawNode
    if (!node.__parentId) {
      finish()
      if (batch.length >= size) {
        yield batch
        batch = []
      }
      rootId = node.id
      group = new Map([[node.id, { ...node, __children: new Map() }]])
      continue
    }
    const parent = group?.get(node.__parentId)
    if (!parent) {
      if (done.has(node.__parentId)) {
        throw new BulkUnavailableError('Shopify sent a nested record after its parent was read')
      }
      continue
    }
    const child: WithChildren = { ...node, __children: new Map() }
    group?.set(node.id, child)
    const type = gidType(node.id)
    const bucket = parent.__children.get(type) ?? []
    bucket.push(child)
    parent.__children.set(type, bucket)
  }
  finish()
  if (batch.length) yield batch
}

/**
 * Read with a bulk operation, streaming, else page by page. Falls back to
 * pages only while nothing has been handed on yet (a bulk op already running,
 * Shopify refusing it, the export failing); a failure after that ends the read,
 * since the writers already have part of it.
 */
export async function* bulkOrPaged<T>(
  bulk: () => AsyncGenerator<T[]>,
  paged: () => AsyncGenerator<T[]>,
  onBulkFallback?: (reason: unknown) => void,
): AsyncGenerator<T[]> {
  let started = false
  try {
    for await (const batch of bulk()) {
      started = true
      yield batch
    }
    return
  } catch (err) {
    if (started) throw err
    onBulkFallback?.(err)
  }
  yield* paged()
}

/** Every record of a bulk result at once; for small results (tests, extra-field owners). */
export async function reassembleBulkStream<T>(
  lines: AsyncGenerator<Record<string, unknown>>,
  childFieldOf: ChildMappingOf,
  connectionDefaults: ChildMapping[] = [],
): Promise<T[]> {
  const out: T[] = []
  for await (const batch of streamBulkRoots<T>(lines, childFieldOf, connectionDefaults)) {
    out.push(...batch)
  }
  return out
}
