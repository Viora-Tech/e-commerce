import { HEAD as LIST_HEAD } from '@/components/table/resource-table/styles'

/*
 * The apps' plain tables (GST invoices, COD/RTO, affiliates, back in stock, Delhivery, MCP) drawn
 * with the list table's measurements (`ResourceTable`, like `SimpleTable`): a 2.5rem header with
 * 0.75rem muted labels and 3.75rem rows on hairlines, 0.75rem sides.
 */
export const HEAD = `${LIST_HEAD} border-b border-border bg-card`
export const CELL = 'h-15 border-b border-border px-3 py-1.5 text-body'
