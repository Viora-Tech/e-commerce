import type { TableSort } from '@/components/table/resource-table'

/*
 * The Orders table's settings, shared by the page and its loading screen
 * (`components/orders/orders-list-skeleton`), so both draw the same columns at the same widths.
 */

/** The order the server sends: Date, newest first. */
export const ORDER_DEFAULT_SORT: TableSort = { id: 'date', desc: true }

/** The viewer's shown columns and their order, remembered in this browser (#9). */
export const ORDER_COLUMNS_KEY = 'orders:columns'

/** Delivery and Tags show on the row by default (#1007); these stay in the columns menu. */
export const ORDER_HIDDEN_COLUMNS = ['fulfilment', 'channel', 'items', 'phone', 'city']

/** `?sort=total.asc` as the table's sort; anything else (or none) is the default. */
export function parseOrderSort(param: string | null): TableSort | null {
  const match = /^([a-z]+)\.(asc|desc)$/.exec(param ?? '')
  return match?.[1] ? { id: match[1], desc: match[2] === 'desc' } : null
}

/** The table's sort as `?sort=`; the default sort leaves the URL clean. */
export function orderSortParam(sort: TableSort | null): string | null {
  if (!sort || (sort.id === ORDER_DEFAULT_SORT.id && sort.desc === ORDER_DEFAULT_SORT.desc))
    return null
  return `${sort.id}.${sort.desc ? 'desc' : 'asc'}`
}
