# Conversion rate counts imported orders on imported-traffic days

Fixes #1124. After #1122, Analytics divided storefront orders by sessions that include Shopify's,
so conversion read 0%. An imported order now converts on a day with `imported_traffic_day` rows;
without them it stays out, as audit #95 needs. No migration; the funnel's orders step follows.
