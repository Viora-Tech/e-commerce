# Admin redesign: Home

Branch `feat/proofly-home`. Figma Home `223:275` (light), `223:436` (dark), desktop only.

Order: greeting + plain summary line, AI ask box with 3 chips (only when the assistant is on),
Finish setting up (products, payments, shipping; hidden when all done or apps not readable),
To do cards (existing "needs you" data), Sales hero (Today / 7 / 30 days, cut from the one
30-day series, no refetch), Latest orders (5) beside Live now (visitors, orders, sales, half
globe), Suggested for you (rule-based, dismiss per browser in localStorage), and a collapsed
"More numbers" holding every previous chart plus insights and the monthly goal.

- Removed: today-briefing, today-sparkline, live-order-stream, live-globe-card (replaced).
  `needs-you-list` became `todo-cards`.
- Copy: `homePageContent` in `data/home.ts` + Hindi overlay. `briefingSentence` became `summaryLine`.
- Page also reads `apps.list` and `orders.abandonedStats` (each falls back to null on no permission).

Not done / data gaps: no visits-per-day data (hero shows orders only); Today chart is orders
per hour (no hourly sales); no festival calendar, so no festival suggestion; no "short product
descriptions" suggestion (no data); latest orders show no city/payment method (not in the
summary); Finish setting up is 3 derived steps, there is no stored onboarding checklist.
