# Attribution: visit → cart → checkout → order funnel (#1023)

`marketingOverview` returns `funnel` (`StoreFunnel`): tracked visits in the period, then carts
started in the period, those that reached checkout (email or phone given, or paid) and those
that became an order. Carts carry the steps, so each is a subset of the one before.
`components/growth/funnel-card.tsx` shows the four counts with bars and each step's share of the
one before, under the KPI strip on Growth → Attribution.
