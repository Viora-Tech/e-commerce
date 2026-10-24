# OAuth callbacks redirect to ADMIN_URL

Behind the proxy, `req.nextUrl.origin` in a route handler is the container's bind address, so every
OAuth callback sent merchants to `https://0.0.0.0:3200/...` after Meta, Google, Razorpay, Search
Console or Shopify. New `apps/admin/src/lib/admin-origin.ts` (`adminUrl(path)`) builds redirects
from `ADMIN_URL`; the four callbacks use it. The sales channel callback now logs why a connect
failed (bad state, not a member, or the platform error) instead of swallowing it.
