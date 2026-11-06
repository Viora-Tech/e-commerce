# A refused store address is queued once

A store address whose hostname the route job refuses went back to `route_status = 'none'`, so the domain poll queued it again every two minutes. Each write to `store_domain` clears the store's page cache and starts a warm, which saturated the storefront under real traffic. The poll now asks only for addresses never asked for.
