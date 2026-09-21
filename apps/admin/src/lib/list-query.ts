/**
 * Server-side twin of the nuqs parsers the list pages use, so `page.tsx` can
 * run the first fetch on the server and hand the client a filled table.
 */
export type SearchParams = Record<string, string | string[] | undefined>

/** Rows per page on every list; lives here (not in a client module) so server pages can import it. */
export const LIST_PER_PAGE = 25

export type ListQuery<S extends string> = { page: number; query: string; status: S | null }

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export function parseListQuery<S extends string>(
  sp: SearchParams,
  statuses: readonly S[],
): ListQuery<S> {
  const page = Number.parseInt(first(sp.page) ?? '', 10)
  const status = first(sp.status)
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    query: first(sp.query) ?? '',
    status: status && (statuses as readonly string[]).includes(status) ? (status as S) : null,
  }
}

export function sameListQuery<S extends string>(a: ListQuery<S>, b: ListQuery<S>): boolean {
  return a.page === b.page && a.query === b.query && a.status === b.status
}
