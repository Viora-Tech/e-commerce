/** SOURCE OF TRUTH: sales channel verdicts — WHAT: which synced items Google and Meta refused, and why / WHY: the channel page says what to fix */
/**
 * After a sync, what the platform will not show: Google's `product_view` report and Meta's
 * catalog review status. Read-only and best effort: the sync never fails because of these.
 */
import { googleError, MERCHANT_API } from './google-merchant'
import { bearer, graph, type MetaApp, request } from './providers'

/** An item the platform will not show, with its reason (the platform's own words or code). */
export type RejectedItem = { id: string; reason: string }

/** How many rejected items a sync keeps for the channel page (the count is the full one). */
const REJECTED_KEEP = 10

/**
 * Google's verdict on what we sent: `reports:search` over `product_view` for items that are
 * not eligible or disapproved, with their first issue code
 * (developers.google.com/merchant/api/guides/reports/quickstart).
 */
export async function googleRejectedItems(
  fetchImpl: typeof fetch,
  token: string,
  accountId: string,
): Promise<{ count: number; items: RejectedItem[] }> {
  type Row = {
    productView?: { offerId?: string; itemIssues?: { type?: { code?: string } }[] }
  }
  const items: RejectedItem[] = []
  let count = 0
  let pageToken: string | undefined
  // A few pages at most: the count is for "N products not shown", not an audit.
  for (let page = 0; page < 5; page += 1) {
    const body = await request<{ results?: Row[]; nextPageToken?: string }>(
      fetchImpl,
      `${MERCHANT_API}/reports/v1/accounts/${accountId}/reports:search`,
      {
        method: 'POST',
        headers: { ...bearer(token), 'content-type': 'application/json' },
        body: JSON.stringify({
          query:
            "SELECT offer_id, item_issues FROM product_view WHERE aggregated_reporting_context_status = 'NOT_ELIGIBLE_OR_DISAPPROVED'",
          pageSize: 1000,
          ...(pageToken ? { pageToken } : {}),
        }),
      },
      googleError,
    )
    for (const r of body.results ?? []) {
      count += 1
      const id = r.productView?.offerId
      if (id && items.length < REJECTED_KEEP)
        items.push({ id, reason: r.productView?.itemIssues?.[0]?.type?.code ?? 'disapproved' })
    }
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  return { count, items }
}

/** Meta's verdict: catalog items whose review was rejected, with Meta's first error. */
export async function metaRejectedItems(
  fetchImpl: typeof fetch,
  app: MetaApp,
  token: string,
  catalogId: string,
): Promise<{ count: number; items: RejectedItem[] }> {
  type Item = {
    retailer_id?: string
    review_status?: string
    errors?: { title?: string; description?: string }[]
  }
  const items: RejectedItem[] = []
  let count = 0
  let path: string | null =
    `/${catalogId}/products?fields=retailer_id,review_status,errors{title}&limit=500`
  for (let page = 0; page < 5 && path; page += 1) {
    const body: { data?: Item[]; paging?: { cursors?: { after?: string }; next?: string } } =
      await graph(fetchImpl, app, token, path)
    for (const item of body.data ?? []) {
      if (item.review_status !== 'rejected') continue
      count += 1
      if (item.retailer_id && items.length < REJECTED_KEEP)
        items.push({ id: item.retailer_id, reason: item.errors?.[0]?.title ?? 'rejected' })
    }
    const after = body.paging?.next ? body.paging.cursors?.after : undefined
    path = after
      ? `/${catalogId}/products?fields=retailer_id,review_status,errors{title}&limit=500&after=${encodeURIComponent(after)}`
      : null
  }
  return { count, items }
}
