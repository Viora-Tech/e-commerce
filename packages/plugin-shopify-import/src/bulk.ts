/**
 * Shopify Admin Bulk Operations: run a query over a whole resource (products,
 * customers, orders) without paying the per-page calculated-cost tax that
 * throttles `ShopifyClient.paginate`. Bulk queries run asynchronously on
 * Shopify's side and answer with a JSONL file instead of a normal response.
 *
 * Shapes and limits verified against shopify.dev on 2026-09-27, API version
 * 2025-07 (this package's `SHOPIFY_API_VERSION`):
 *  - https://shopify.dev/docs/api/usage/bulk-operations/queries
 *    - `bulkOperationRunQuery(query: String!)`, `bulkOperation { id status }`.
 *    - Poll `currentBulkOperation { status errorCode url partialDataUrl }`
 *      (this API version predates 2026-01, so there is no `bulkOperation(id:)`
 *      lookup and only one bulk query per app per shop can run at a time).
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
 */
import type { ShopifyClient } from './shopify-client'

export class BulkUnavailableError extends Error {}

type BulkStatus = 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED'

type CurrentBulkOperation = {
  id: string
  status: BulkStatus
  errorCode: string | null
  url: string | null
  partialDataUrl: string | null
} | null

const CURRENT_BULK_OPERATION_QUERY = `{
  currentBulkOperation {
    id status errorCode url partialDataUrl
  }
}`

const RUN_QUERY_MUTATION = `mutation RunBulkQuery($query: String!) {
  bulkOperationRunQuery(query: $query) {
    bulkOperation { id status }
    userErrors { field message }
  }
}`

export type BulkPollOptions = {
  /** Overridable in tests; production defaults to something well within Shopify's own guidance. */
  intervalMs?: number
  maxPolls?: number
}

async function currentBulkOperation(client: ShopifyClient): Promise<CurrentBulkOperation> {
  const data = await client.query<{ currentBulkOperation: CurrentBulkOperation }>(
    CURRENT_BULK_OPERATION_QUERY,
    {},
    1,
  )
  return data.currentBulkOperation
}

/**
 * Submit `query` (a bulk-shaped query string, `edges { node { ... } }`, no
 * pagination args) and poll until it finishes. Throws `BulkUnavailableError`
 * for anything the caller should treat as "fall back to paged fetching":
 * another bulk op already running for this app/shop, Shopify rejecting the
 * query, or the operation itself failing.
 */
export async function runBulkQuery(
  client: ShopifyClient,
  query: string,
  opts: BulkPollOptions = {},
): Promise<string | null> {
  const already = await currentBulkOperation(client)
  if (already && (already.status === 'CREATED' || already.status === 'RUNNING')) {
    throw new BulkUnavailableError('A bulk operation is already running for this app and shop')
  }

  const started = await client.query<{
    bulkOperationRunQuery: {
      bulkOperation: { id: string; status: BulkStatus } | null
      userErrors: { field: string[] | null; message: string }[]
    }
  }>(RUN_QUERY_MUTATION, { query }, 10)
  const { bulkOperation, userErrors } = started.bulkOperationRunQuery
  if (userErrors.length > 0) {
    throw new BulkUnavailableError(userErrors.map((e) => e.message).join('; '))
  }
  if (!bulkOperation) throw new BulkUnavailableError('Shopify did not start the bulk operation')

  const intervalMs = opts.intervalMs ?? 1500
  const maxPolls = opts.maxPolls ?? 400
  for (let poll = 0; poll < maxPolls; poll++) {
    const op = await currentBulkOperation(client)
    if (!op || op.id !== bulkOperation.id) {
      // Someone else's operation replaced ours in `currentBulkOperation` before we saw completion.
      throw new BulkUnavailableError('Lost track of the bulk operation')
    }
    if (op.status === 'COMPLETED') return op.url
    if (op.status === 'FAILED' || op.status === 'CANCELED') {
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
type WithChildren = RawNode & { __children: Map<string, RawNode[]> }

/**
 * Reassemble a bulk-operation JSONL stream into the same nested shape a paged
 * query would have produced (`{ nodes: [...] }` or, for a field that pairs
 * with a `hasNextPage` check elsewhere, `{ pageInfo, nodes: [...] }`), so the
 * existing `map*` functions in `shopify-api.ts` can read either.
 *
 * `childFieldOf` says which field name (and shape) a child's GID type maps to
 * on its parent, e.g. `ProductVariant -> variants` (paged) or
 * `MediaImage -> media` (plain `nodes`). Types with no mapping are dropped.
 */
export async function reassembleBulkStream<T>(
  lines: AsyncGenerator<Record<string, unknown>>,
  childFieldOf: (gidType: string) => ChildMapping | null,
  /**
   * Connections that must be present even when empty (a product with no
   * images has zero `MediaImage` lines, but callers still expect `media.nodes`).
   */
  connectionDefaults: ChildMapping[] = [],
): Promise<T[]> {
  const byId = new Map<string, WithChildren>()
  const rootOrder: string[] = []
  for await (const raw of lines) {
    const node = raw as RawNode
    const withChildren: WithChildren = { ...node, __children: new Map() }
    byId.set(node.id, withChildren)
    if (!node.__parentId) rootOrder.push(node.id)
  }
  for (const node of byId.values()) {
    if (!node.__parentId) continue
    const parent = byId.get(node.__parentId)
    if (!parent) continue
    const type = gidType(node.id)
    const bucket = parent.__children.get(type) ?? []
    bucket.push(node)
    parent.__children.set(type, bucket)
  }
  const attach = (node: WithChildren): unknown => {
    const out: Record<string, unknown> = { ...node }
    delete out.__children
    delete out.__parentId
    for (const d of connectionDefaults) {
      out[d.field] = d.asPage
        ? { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] }
        : { nodes: [] }
    }
    for (const [type, children] of node.__children) {
      const mapping = childFieldOf(type)
      if (!mapping) continue
      const mapped = children.map((c) => attach(byId.get(c.id) ?? { ...c, __children: new Map() }))
      out[mapping.field] = mapping.asPage
        ? { pageInfo: { hasNextPage: false, endCursor: null }, nodes: mapped }
        : { nodes: mapped }
    }
    return out
  }
  return rootOrder.map((id) => attach(byId.get(id) as WithChildren)) as T[]
}
