# Storefront autoscaling

Status: proposal (2026-10-18). Owner decides the phases; nothing here is built yet beyond what
"Today" lists.

## Why

Admin, worker, Postgres and backups have predictable load: merchants and their staff, queued
jobs, one nightly dump. Storefront traffic does not: a sale, an influencer post or a festival
day can bring 10–100× normal traffic to one store within minutes, and every store shares one
storefront app on one `t3a.medium` (4 GB) that also runs admin, worker, Postgres and Dragonfly.
The goal is a storefront that absorbs a spike without manual work and without slowing the other
stores or the admin.

**Success**: a 20× spike on one store's catalogue pages leaves checkout p95 under 1.5 s and the
admin usable; the platform scales back down on its own; the month's bill stays predictable.

**Non-goals**: moving admin or worker; multi-region; rewriting the storefront for another
runtime (Cloudflare Workers / Lambda were weighed and rejected, see "Rejected").

## Today

- `apps/storefront/src/lib/edge-cache.ts` already marks catalogue and content pages from
  cookie-less visitors as shareable (`s-maxage=STOREFRONT_EDGE_TTL`, default 30 s,
  `stale-while-revalidate` 10×). Cart, checkout, account, actions and APIs stay private.
  `apps/docs/content/developer-docs/operations` → performance.mdx "Shared caches" has the
  Cloudflare cache rule.
- Nothing sits in front of the storefront yet: store hosts are DNS only to the server
  (Traefik + Let's Encrypt), merchant custom domains point at it by A/CNAME.
- One storefront container; Postgres (RLS, per-request transactions via `inStore`) on the same
  box; Dragonfly for queues/cache.

## Design: three layers

### 1. Edge — Cloudflare for SaaS in front of every store host

All store traffic (`<slug>.koomerce.app` and merchant custom domains) goes through Cloudflare:

- **Custom hostnames** (Cloudflare for SaaS) on the koomerce.app zone, fallback origin
  `shops.koomerce.app`. A merchant's domain CNAMEs to us exactly as today; Cloudflare issues its
  certificate. First 100 hostnames free, then about $0.10/hostname/month.
- The existing cache rule (performance.mdx) makes the shareable pages a cache hit for most of a
  spike: first-time visitors browsing products are exactly the traffic that surges.
- Origin TLS: a Cloudflare origin certificate on Traefik for the fallback origin; SSL mode Full
  (strict).
- Bot protection on the paths that cost money (OTP send, login, checkout): Turnstile in the forms
  plus WAF rate limits. Never on the worker's webhook host.

What changes in code:
- `DOMAIN_PROVIDER` gains a `cloudflare-saas` mode: create/delete a custom hostname through the
  Cloudflare API instead of a Dokploy domain; verification reads the hostname's status instead of
  checking the A record against the server IP (behind the proxy that check can never pass).
- `certificate-retry` and the domains UI read the custom hostname status.
- Store writes that change what a page shows already re-render at the origin; with a 30 s TTL no
  purge is required. Optional: purge a store's hostnames on theme publish.

### 2. App — storefront on ECS Fargate (ap-south-1)

- The storefront image (already in ECR) runs as a Fargate service behind an ALB, in the same VPC
  as the database. The ALB is the Cloudflare origin for store traffic.
- Target-tracking autoscaling on ALB requests per target and CPU; min 2 tasks (0.5 vCPU / 1 GB),
  max 10–20; scale-out cooldown short (60 s), scale-in long (10 min).
- Health check `/api/health` (or the existing one); deploys roll task by task.
- Admin, worker, Dragonfly stay on the Dokploy box; only the storefront moves.

### 3. Database — pooling first, managed later

The real limit: 20 storefront tasks × their pool can exhaust Postgres connections.

- **PgBouncer in transaction mode** in front of Postgres before Fargate goes live. Check that
  `inStore`'s `SET LOCAL` (RLS context) runs inside the same transaction, which transaction
  pooling preserves; session-level `SET` would not survive and must not be used.
- Per-task pool small (e.g. 5); PgBouncer `max_client_conn` high, `default_pool_size` sized to
  Postgres.
- When the box is tight: Postgres to RDS (`db.t4g.medium`), later a read replica for catalogue
  reads (storefront only, read-only queries).

## Phases (each one ships on its own)

| Phase | Work | Done when | Rough cost |
| --- | --- | --- | --- |
| 1. Edge cache | Cloudflare for SaaS + cache rule + `cloudflare-saas` domain provider; migrate existing store hosts | A product page shows `cf-cache-status: HIT` for a cookie-less visitor on a store subdomain and on a custom domain | $0 up to 100 domains |
| 2. Measure | k6 load test against a staging store: browse mix (80 %), cart (15 %), checkout (5 %) | We know requests/s at which p95 crosses 1.5 s on today's box | $0 |
| 3. Pooling | PgBouncer on the box, storefront and admin through it | Load test repeated with no connection errors | $0 |
| 4. Fargate | Storefront service + ALB + autoscaling; Cloudflare origin → ALB | A 20× load test scales out and back in by itself | ~$30–35 (2 tasks) + ~$20 ALB / month |
| 5. RDS | Move Postgres off the box (when phase 2/4 numbers say so) | Box free of Postgres; restore drill passes | ~$30–60 / month |

## Risks

- **Cache leaks a personal page.** Mitigated twice: the origin marks personal pages private, and
  the Cloudflare rule bypasses on our cookies. Phase 1 test: a visitor with a cart never gets
  `HIT`.
- **Webhooks behind challenges.** Keep `api.koomerce.app` out of Bot Fight Mode and challenges.
- **RLS under pooling.** Transaction pooling plus `SET LOCAL` only; a test that runs two stores'
  requests interleaved through PgBouncer and checks no cross-store reads.
- **Two hosting setups** (Dokploy box + Fargate). Accepted for the storefront only; document
  deploys for both.

## Rejected

- **Cloudflare Workers / OpenNext**: Postgres needs Hyperdrive and RLS through its pooling,
  Dragonfly is private, Liquid rendering hits CPU limits, bundle near the size cap.
- **Lambda**: cold starts on Next pages and a connection per invocation (RDS Proxy needed); cost
  hard to predict at volume.
- **Bigger single box / Swarm nodes**: cheapest now but no autoscaling and one point of failure.
- **Vercel**: easy scaling, usage billing on every merchant's traffic, database far away.

## Open questions for the owner

1. Phase 1 only now, or 1–3 together?
2. Staging store for load tests: a copy of a dummy store on the same box, or a separate small
   instance?
3. Budget ceiling per month for the storefront tier.
