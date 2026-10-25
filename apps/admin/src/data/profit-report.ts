/** Copy for the summary on the Profit reports (Analytics › Reports › Profit by month / product). */
export const profitReportContent = {
  title: 'Profit you can count on',
  floor:
    'Based on the costs you entered. Your real profit may be higher or lower if some costs differ.',
  netProfit: 'Net profit',
  atLeast: 'At least',
  perOrder: 'Average profit per order',
  perUnit: 'Average profit per unit',
  basket: (size: string) => (size === '1' ? '1 item orders' : `${size} item orders`),
  basketNote: (orders: number) => (orders === 1 ? '1 order' : `${orders} orders`),
  basketTitle: 'Profit per order by basket size',
  basketHelp: 'One parcel and one delivery for the whole basket, so bigger baskets earn more.',
  expensesNote: (expenses: string) => `After ${expenses} of monthly expenses`,
  noOrders: 'No orders',
  estimated: (estimated: number, orders: number) =>
    `${estimated} of ${orders} orders still estimated`,
  allReal: 'Every cost is known',
  estimatedHelp:
    'Packing, delivery or a payment fee is still an estimate on these orders; it becomes real when the courier or gateway reports it.',
  profitable: 'Profitable in these dates',
  short: (amount: string, orders: number | null) =>
    orders === null
      ? `${amount} short of your expenses`
      : `${amount} short: about ${orders} more ${orders === 1 ? 'order' : 'orders'} at your average profit`,
  soFar: (month: string, days: number, total: number, counted: string, full: string) =>
    `${month} is still going: expenses count ${days} of ${total} days so far (${counted} of ${full}).`,
  manageExpenses: 'Monthly expenses',
  setCosts: 'Costs for profit',
}
