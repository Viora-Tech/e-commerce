/** Copy for the admin home (dashboard). */
export const homeContent = {
  period: 'Last 7 days',
  previous: 'Previous 7 days',
  stats: {
    sales: { title: 'Total sales', unit: 'Sales' },
    orders: { title: 'Total orders', unit: 'Orders' },
    pendingCancelled: { title: 'Pending & cancelled', pending: 'Pending', cancelled: 'Cancelled' },
  },
  report: {
    title: 'Report for this week',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    tabs: {
      customers: 'Customers',
      products: 'Total products',
      inStock: 'In stock',
      outOfStock: 'Out of stock',
      revenue: 'Revenue',
    },
  },
  recentOrders: {
    title: 'Recent orders',
    columns: { order: 'Order', date: 'Order date', status: 'Status', amount: 'Amount' },
    empty: 'Orders appear here as soon as a customer checks out.',
  },
  topProducts: {
    title: 'Top products',
    all: 'All products',
    units: (n: number) => `${n} sold`,
    empty: 'Sales in the last 30 days will rank products here.',
  },
  lowStock: {
    title: 'Low stock',
    subtitle: (threshold: number) => `Variants at or below ${threshold} units`,
    left: (n: number) => (n <= 0 ? 'Out of stock' : `${n} left`),
    empty: 'Every tracked variant has stock.',
    restock: 'Restock',
  },
  bestSelling: {
    title: 'Best selling products',
    columns: { product: 'Product', totalOrder: 'Total order', status: 'Status', price: 'Price' },
    inStock: 'Stock',
    outOfStock: 'Stock out',
  },
} as const
