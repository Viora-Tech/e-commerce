# Create shipment: PIN-only pickup reads clearly (#1450)

When the default pickup has only a PIN code (Settings › Shipping › Dispatch has no street):
the route bar shows the pickup name and PIN instead of a link; Ship from adds "Couriers pick up
from the address saved in their own panel." and a smaller "Add street address" link
(`route-card.tsx`, copy in `data/create-shipment.ts` + Hindi).
