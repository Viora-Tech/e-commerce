/** The report catalogue. Slugs are URLs, so they never change once shipped. */

export type ReportCategory = 'sales' | 'orders' | 'customers' | 'products' | 'marketing'

export type ReportDefinition = {
  slug: string
  title: string
  description: string
  category: ReportCategory
  /** False while a report has no query behind it yet; the list shows it greyed. */
  available: boolean
  /** Column ids the page renders, in order. */
  columns: ('label' | 'detail' | 'orders' | 'units' | 'revenue')[]
}

export const REPORTS: readonly ReportDefinition[] = [
  {
    slug: 'sales-over-time',
    title: 'Sales over time',
    description: 'Revenue and order count for every day in the range.',
    category: 'sales',
    available: true,
    columns: ['label', 'orders', 'revenue'],
  },
  {
    slug: 'sales-by-product',
    title: 'Sales by product',
    description: 'Units sold and revenue per product, best sellers first.',
    category: 'products',
    available: true,
    columns: ['label', 'detail', 'orders', 'units', 'revenue'],
  },
  {
    slug: 'sales-by-state',
    title: 'Sales by state',
    description: 'Where orders ship, by revenue.',
    category: 'sales',
    available: true,
    columns: ['label', 'orders', 'revenue'],
  },
  {
    slug: 'discount-performance',
    title: 'Discount performance',
    description: 'Orders and revenue attributed to each discount.',
    category: 'marketing',
    available: true,
    columns: ['label', 'detail', 'orders', 'revenue'],
  },
  {
    slug: 'orders-by-status',
    title: 'Orders by status',
    description: 'How many orders sit at each step, from placed to delivered.',
    category: 'orders',
    available: false,
    columns: ['label', 'orders'],
  },
  {
    slug: 'customers-over-time',
    title: 'Customers over time',
    description: 'New and returning customers per day.',
    category: 'customers',
    available: false,
    columns: ['label', 'orders'],
  },
  {
    slug: 'first-time-vs-returning',
    title: 'First time vs returning',
    description: 'Revenue split between new and repeat buyers.',
    category: 'customers',
    available: false,
    columns: ['label', 'orders', 'revenue'],
  },
  {
    slug: 'inventory-on-hand',
    title: 'Inventory on hand',
    description: 'Stock and value per variant at the end of the range.',
    category: 'products',
    available: false,
    columns: ['label', 'units'],
  },
] as const

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  'sales',
  'orders',
  'customers',
  'products',
  'marketing',
]

export function findReport(slug: string): ReportDefinition | undefined {
  return REPORTS.find((r) => r.slug === slug)
}
