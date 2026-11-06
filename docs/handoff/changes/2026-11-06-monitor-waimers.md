# Monitor watches www.waimers.in

The uptime check still pointed at the old waimers.vioratech.in address. It now checks www.waimers.in, and also the home page, because the health route skips the store's pages.

Deploy it from apps/monitor with `bunx wrangler deploy`.
