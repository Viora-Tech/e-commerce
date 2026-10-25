/** The report catalogue. Slugs are URLs, so they never change once shipped. */

export type ReportCategory =
  | 'sales'
  | 'finance'
  | 'orders'
  | 'fulfilment'
  | 'returns'
  | 'customers'
  | 'inventory'
  | 'marketing'

/**
 * How a column's values render. `state` holds a two-letter state code, `payment`
 * a payment method id and `label` a fixed key (order status, COD or prepaid, a
 * finance line); the admin turns each into words.
 */
export type ReportColumnKind =
  | 'text'
  | 'date'
  | 'month'
  | 'state'
  | 'payment'
  | 'label'
  | 'count'
  | 'money'
  | 'percent'
  | 'decimal'
  | 'hours'
  | 'days'

export type ReportColumn = { id: string; kind: ReportColumnKind }

export type ReportDefinition = {
  slug: string
  title: string
  description: string
  category: ReportCategory
  /** False while a report has no data behind it; the list shows it greyed with `missing`. */
  available: boolean
  /** Why an unavailable report cannot be built yet. */
  missing?: string
  /** Column ids the page renders, in order. The first is the row label. */
  columns: ReportColumn[]
  /** Column plotted and compared with the previous period. */
  metric: string
  /** `series`: one row per day or month, drawn as a line. `bars`: top rows as bars. */
  chart: 'series' | 'bars'
  /** False for snapshots (stock on hand) that ignore the date range. */
  ranged: boolean
}

const c = (id: string, kind: ReportColumnKind): ReportColumn => ({ id, kind })

/* Column ids shared across reports; the admin holds one label per id. */
const ORDERS = c('orders', 'count')
const UNITS = c('units', 'count')
const GROSS = c('grossSales', 'money')
const TOTAL = c('totalSales', 'money')
const AOV = c('aov', 'money')
const SHARE = c('share', 'percent')
const SHIPMENTS = c('shipments', 'count')
const DELIVERED = c('delivered', 'count')
const RTO = c('rto', 'count')
const RTO_RATE = c('rtoRate', 'percent')
const IN_TRANSIT = c('inTransit', 'count')

const shipping = (first: ReportColumn): ReportColumn[] => [
  first,
  SHIPMENTS,
  DELIVERED,
  RTO,
  IN_TRANSIT,
  RTO_RATE,
]

type Entry = Omit<ReportDefinition, 'available' | 'ranged'> & {
  available?: boolean
  ranged?: boolean
}

const ENTRIES: Entry[] = [
  // Sales
  {
    slug: 'sales-over-time',
    title: 'Sales over time',
    description: 'Gross sales, discounts, returns, shipping and total sales for every day.',
    category: 'sales',
    columns: [
      c('day', 'date'),
      ORDERS,
      GROSS,
      c('discounts', 'money'),
      c('returns', 'money'),
      c('netSales', 'money'),
      c('shipping', 'money'),
      c('paymentFees', 'money'),
      TOTAL,
      c('taxes', 'money'),
    ],
    metric: 'totalSales',
    chart: 'series',
  },
  {
    slug: 'sales-by-product',
    title: 'Sales by product',
    description: 'Units sold and gross sales per product, best sellers first.',
    category: 'sales',
    columns: [c('product', 'text'), c('vendor', 'text'), ORDERS, UNITS, GROSS, SHARE],
    metric: 'grossSales',
    chart: 'bars',
  },
  {
    slug: 'sales-by-variant',
    title: 'Sales by variant and SKU',
    description: 'Every variant that sold, with its SKU, units and gross sales.',
    category: 'sales',
    columns: [c('variant', 'text'), c('sku', 'text'), ORDERS, UNITS, GROSS, SHARE],
    metric: 'grossSales',
    chart: 'bars',
  },
  {
    slug: 'sales-by-vendor',
    title: 'Sales by vendor',
    description: 'Gross sales grouped by the brand or vendor on each product.',
    category: 'sales',
    columns: [c('vendor', 'text'), c('products', 'count'), ORDERS, UNITS, GROSS, SHARE],
    metric: 'grossSales',
    chart: 'bars',
  },
  {
    slug: 'sales-by-product-type',
    title: 'Sales by product type',
    description: 'Gross sales grouped by product type.',
    category: 'sales',
    columns: [c('productType', 'text'), c('products', 'count'), ORDERS, UNITS, GROSS, SHARE],
    metric: 'grossSales',
    chart: 'bars',
  },
  {
    slug: 'sales-by-state',
    title: 'Sales by state',
    description: 'Where orders ship, by total sales, with the COD share per state.',
    category: 'sales',
    columns: [c('state', 'state'), ORDERS, TOTAL, AOV, c('codShare', 'percent'), SHARE],
    metric: 'totalSales',
    chart: 'bars',
  },
  {
    slug: 'sales-by-pincode',
    title: 'Sales by pincode',
    description: 'Top delivery pincodes by total sales.',
    category: 'sales',
    columns: [c('pincode', 'text'), c('city', 'text'), c('state', 'state'), ORDERS, TOTAL, AOV],
    metric: 'totalSales',
    chart: 'bars',
  },
  {
    slug: 'sales-by-payment-method',
    title: 'Sales by payment method',
    description: 'Orders and total sales for each way shoppers paid.',
    category: 'sales',
    columns: [c('method', 'payment'), c('paymentType', 'label'), ORDERS, TOTAL, AOV, SHARE],
    metric: 'totalSales',
    chart: 'bars',
  },
  {
    slug: 'cod-vs-prepaid',
    title: 'COD vs prepaid',
    description: 'Cash on delivery against prepaid: orders, value, cancellations and RTO.',
    category: 'sales',
    columns: [
      c('paymentType', 'label'),
      ORDERS,
      TOTAL,
      AOV,
      SHARE,
      c('cancelled', 'count'),
      RTO_RATE,
    ],
    metric: 'orders',
    chart: 'bars',
  },
  {
    slug: 'sales-by-channel',
    title: 'Sales by channel and UTM',
    description:
      'Orders by marketing channel and UTM source, medium and campaign. Tracked from the storefront visit that led to the order.',
    category: 'marketing',
    columns: [
      c('channel', 'text'),
      c('source', 'text'),
      c('campaign', 'text'),
      ORDERS,
      TOTAL,
      AOV,
      SHARE,
    ],
    metric: 'totalSales',
    chart: 'bars',
  },

  // Finance
  {
    slug: 'gross-to-net',
    title: 'Gross to net sales',
    description:
      'Gross sales, discounts, returns, net sales, shipping and GST split into CGST, SGST and IGST.',
    category: 'finance',
    columns: [c('line', 'label'), c('amount', 'money')],
    metric: 'amount',
    chart: 'series',
  },
  {
    slug: 'profit-by-month',
    title: 'Profit by month',
    description:
      'Net sales without GST, less goods, packing, delivery, payment fees and RTO costs, then your monthly expenses: net profit.',
    category: 'finance',
    columns: [
      c('month', 'month'),
      ORDERS,
      c('netSales', 'money'),
      c('costOfGoods', 'money'),
      c('packingCost', 'money'),
      c('courierCost', 'money'),
      c('gatewayFees', 'money'),
      c('rtoCost', 'money'),
      c('profit', 'money'),
      c('expenses', 'money'),
      c('netProfit', 'money'),
      c('margin', 'percent'),
      c('estimatedOrders', 'count'),
    ],
    metric: 'netProfit',
    chart: 'series',
  },
  {
    slug: 'profit-by-product',
    title: 'Profit by product',
    description:
      'What each product earned after its cost and its share of packing, delivery, payment fees and RTO costs, per unit too, best first.',
    category: 'finance',
    columns: [
      c('product', 'text'),
      UNITS,
      c('netSales', 'money'),
      c('costOfGoods', 'money'),
      c('profit', 'money'),
      c('profitPerUnit', 'money'),
      c('margin', 'percent'),
    ],
    metric: 'profit',
    chart: 'bars',
  },
  {
    slug: 'payments-by-method',
    title: 'Payments by method',
    description:
      'Money received by UPI, bank transfer, cash, cheque or gateway, including payments you marked as paid by hand.',
    category: 'finance',
    columns: [
      c('method', 'payment'),
      c('recorded', 'label'),
      c('payments', 'count'),
      c('amount', 'money'),
      SHARE,
    ],
    metric: 'amount',
    chart: 'bars',
  },

  // Orders
  {
    slug: 'orders-over-time',
    title: 'Orders over time',
    description: 'Orders, units and cancellations placed each day.',
    category: 'orders',
    columns: [
      c('day', 'date'),
      ORDERS,
      UNITS,
      c('unitsPerOrder', 'decimal'),
      c('cancelled', 'count'),
    ],
    metric: 'orders',
    chart: 'series',
  },
  {
    slug: 'aov-over-time',
    title: 'Average order value over time',
    description: 'Total sales divided by orders, day by day.',
    category: 'orders',
    columns: [c('day', 'date'), ORDERS, TOTAL, AOV],
    metric: 'aov',
    chart: 'series',
  },
  {
    slug: 'orders-by-status',
    title: 'Orders by status',
    description:
      'Where the orders placed in the range stand now: open orders by fulfilment, then completed and cancelled.',
    category: 'orders',
    columns: [c('status', 'label'), ORDERS, TOTAL, SHARE],
    metric: 'orders',
    chart: 'bars',
  },
  {
    slug: 'orders-by-payment-status',
    title: 'Orders by payment status',
    description:
      'How much of the money is in for the orders placed in the range, cancelled left out.',
    category: 'orders',
    columns: [c('paymentStatus', 'label'), ORDERS, TOTAL, SHARE],
    metric: 'orders',
    chart: 'bars',
  },

  // Fulfilment and shipping
  {
    slug: 'fulfilment-time',
    title: 'Dispatch and delivery time',
    description: 'Hours from order to dispatch and days from order to delivery, by order day.',
    category: 'fulfilment',
    columns: [
      c('day', 'date'),
      ORDERS,
      SHIPMENTS,
      c('dispatchHours', 'hours'),
      DELIVERED,
      c('deliveryDays', 'days'),
    ],
    metric: 'dispatchHours',
    chart: 'series',
  },
  {
    slug: 'shipping-by-courier',
    title: 'Shipping by courier',
    description: 'Dispatch speed, delivery time and RTO rate for each courier.',
    category: 'fulfilment',
    columns: [
      c('courier', 'text'),
      SHIPMENTS,
      c('dispatchHours', 'hours'),
      DELIVERED,
      c('deliveryDays', 'days'),
      RTO,
      RTO_RATE,
    ],
    metric: 'shipments',
    chart: 'bars',
  },
  {
    slug: 'rto-by-state',
    title: 'RTO by state',
    description: 'Shipments returned to origin, by delivery state.',
    category: 'fulfilment',
    columns: shipping(c('state', 'state')),
    metric: 'rto',
    chart: 'bars',
  },
  {
    slug: 'rto-by-pincode',
    title: 'RTO by pincode',
    description: 'Pincodes with the most shipments returned to origin.',
    category: 'fulfilment',
    columns: [
      c('pincode', 'text'),
      c('city', 'text'),
      c('state', 'state'),
      ...shipping(c('pincode', 'text')).slice(1),
    ],
    metric: 'rto',
    chart: 'bars',
  },
  {
    slug: 'rto-by-payment',
    title: 'RTO by payment method',
    description: 'Return to origin rate for COD against prepaid orders.',
    category: 'fulfilment',
    columns: shipping(c('method', 'payment')),
    metric: 'rto',
    chart: 'bars',
  },

  // Returns
  {
    slug: 'refunds-by-reason',
    title: 'Refunds by reason',
    description: 'Money returned to shoppers, grouped by the reason recorded on the refund.',
    category: 'returns',
    columns: [c('reason', 'text'), c('refunds', 'count'), ORDERS, c('refunded', 'money'), SHARE],
    metric: 'refunded',
    chart: 'bars',
  },
  {
    slug: 'returns-by-product',
    title: 'Returns by product',
    description: 'Units restocked as returned against units sold, per variant.',
    category: 'returns',
    columns: [
      c('variant', 'text'),
      c('sku', 'text'),
      c('returned', 'count'),
      c('sold', 'count'),
      c('returnRate', 'percent'),
    ],
    metric: 'returned',
    chart: 'bars',
  },

  // Customers
  {
    slug: 'customers-over-time',
    title: 'Customers over time',
    description: 'New and returning customers who ordered each day.',
    category: 'customers',
    columns: [
      c('day', 'date'),
      c('customers', 'count'),
      c('newCustomers', 'count'),
      c('returningCustomers', 'count'),
      ORDERS,
    ],
    metric: 'customers',
    chart: 'series',
  },
  {
    slug: 'first-time-vs-returning',
    title: 'First time vs returning',
    description: 'Orders and total sales split between first orders and repeat buyers.',
    category: 'customers',
    columns: [c('segment', 'label'), c('customers', 'count'), ORDERS, TOTAL, AOV, SHARE],
    metric: 'totalSales',
    chart: 'bars',
  },
  {
    slug: 'customer-cohorts',
    title: 'Customer cohorts',
    description: 'Customers grouped by the month of their first order, with how many came back.',
    category: 'customers',
    columns: [
      c('cohort', 'month'),
      c('customers', 'count'),
      c('repeatCustomers', 'count'),
      c('repeatRate', 'percent'),
      ORDERS,
      c('lifetimeSales', 'money'),
      c('salesPerCustomer', 'money'),
    ],
    metric: 'repeatRate',
    chart: 'series',
  },
  {
    slug: 'top-customers',
    title: 'Top customers by spend',
    description: 'The customers who spent the most in the range.',
    category: 'customers',
    columns: [
      c('customer', 'text'),
      c('email', 'text'),
      c('state', 'state'),
      ORDERS,
      TOTAL,
      AOV,
      c('lastOrder', 'date'),
    ],
    metric: 'totalSales',
    chart: 'bars',
  },

  // Inventory
  {
    slug: 'inventory-on-hand',
    title: 'Stock on hand by location',
    description:
      'Units on hand, committed, available and incoming, with stock value, at each location.',
    category: 'inventory',
    ranged: false,
    columns: [
      c('location', 'text'),
      c('variants', 'count'),
      c('onHand', 'count'),
      c('committed', 'count'),
      c('available', 'count'),
      c('incoming', 'count'),
      c('costValue', 'money'),
      c('retailValue', 'money'),
    ],
    metric: 'onHand',
    chart: 'bars',
  },
  {
    slug: 'sell-through',
    title: 'Sell-through rate',
    description: 'Units sold in the range against the stock that was there to sell.',
    category: 'inventory',
    columns: [
      c('variant', 'text'),
      c('sku', 'text'),
      c('sold', 'count'),
      c('onHand', 'count'),
      c('sellThrough', 'percent'),
    ],
    metric: 'sold',
    chart: 'bars',
  },
  {
    slug: 'days-of-cover',
    title: 'Days of cover',
    description: 'How long available stock lasts at the daily sales rate of the range.',
    category: 'inventory',
    columns: [
      c('variant', 'text'),
      c('sku', 'text'),
      c('available', 'count'),
      c('perDay', 'decimal'),
      c('daysOfCover', 'days'),
    ],
    metric: 'perDay',
    chart: 'bars',
  },
  {
    slug: 'abc-analysis',
    title: 'ABC analysis',
    description: 'Products ranked by sales: A earns the first 80%, B the next 15%, C the rest.',
    category: 'inventory',
    columns: [
      c('product', 'text'),
      c('abcClass', 'text'),
      UNITS,
      GROSS,
      SHARE,
      c('cumulativeShare', 'percent'),
    ],
    metric: 'grossSales',
    chart: 'bars',
  },
  {
    slug: 'low-stock',
    title: 'Low stock',
    description: 'Variants at or below the low stock threshold, with how fast they sell.',
    category: 'inventory',
    columns: [
      c('variant', 'text'),
      c('sku', 'text'),
      c('available', 'count'),
      c('committed', 'count'),
      c('incoming', 'count'),
      c('sold', 'count'),
      c('daysOfCover', 'days'),
    ],
    metric: 'sold',
    chart: 'bars',
  },

  // Marketing
  {
    slug: 'discount-performance',
    title: 'Sales by discount code',
    description: 'Orders, money given away and total sales for each discount.',
    category: 'marketing',
    columns: [
      c('discount', 'text'),
      c('code', 'text'),
      ORDERS,
      c('discounts', 'money'),
      TOTAL,
      AOV,
    ],
    metric: 'totalSales',
    chart: 'bars',
  },
]

export const REPORTS: readonly ReportDefinition[] = ENTRIES.map((e) => ({
  ...e,
  available: e.available ?? true,
  ranged: e.ranged ?? true,
}))

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  'sales',
  'finance',
  'orders',
  'fulfilment',
  'returns',
  'customers',
  'inventory',
  'marketing',
]

export function findReport(slug: string): ReportDefinition | undefined {
  return REPORTS.find((r) => r.slug === slug)
}
