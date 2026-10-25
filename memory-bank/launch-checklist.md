# Koomerce launch checklist

Status of the koomerce.app move and the launch work, last updated 2026-10-18. Owner = who does
it ("owner" is the founder, "agent" is a Claude session). Move a line to Done with its date.

## Live setup (2026-10-18)

| What | Where |
| --- | --- |
| Landing site | https://koomerce.app (Cloudflare Workers `koomerce-www`, static export + `/api/forms` Worker) |
| Docs | https://docs.koomerce.app (Cloudflare Workers `koomerce-docs`) |
| Admin | https://admin.koomerce.app (Dokploy project "Koomerce", app `admin`); `admin.vioratech.in` 308-redirects here |
| Worker / webhooks | https://api.koomerce.app (worker.vioratech.in removed 2026-10-19) |
| Platform storefront host | `shops.koomerce.app` (CNAME target); new stores get `<slug>.koomerce.app` |
| Media | R2 `koomerce-media` at https://cdn.koomerce.app; `/private/` paths blocked by a WAF rule |
| Backups | R2 `koomerce-backup` (not yet receiving dumps; skipped during testing) |
| Email in | `support@koomerce.app` forwards to vioramice@gmail.com (Cloudflare Email Routing) |
| Forms | D1 `koomerce-www-forms`, Turnstile widget "koomerce.app forms"; entries emailed to vioramice@gmail.com |
| Dokploy panel | https://dokploy.vioratech.in (stays on vioratech.in) |

DNS on Cloudflare: `admin`, `api`, `shops`, `*` are DNS only (grey) because Traefik issues their
certificates and the worker checks store records against the server IP. `koomerce.app`, `www`,
`docs`, `cdn` are proxied (served by Cloudflare).

## To do

| Item | Owner | Notes |
| --- | --- | --- |
| Webhook URLs → `api.koomerce.app` in Razorpay, Decentro, Delhivery, Shiprocket, RapidShyp | owner | Copy each from admin Settings; Razorpay OAuth callback `https://admin.koomerce.app/api/apps/razorpay/oauth/callback` |
| Razorpay missing at checkout | owner → agent | Check an online method is on and the app installed; else storefront log line `misconfigured payment providers` |
| Store storage connections → `koomerce-media`, public URL `https://cdn.koomerce.app` | owner | Admin → Storage, per store; then upload one image to test |
| SES `koomerce.app`: 3 DKIM CNAMEs + `bounce` MX/TXT | owner | Then `PLATFORM_EMAIL_FROM=no-reply@koomerce.app` in admin + worker, redeploy |
| Cloudflare Workers Builds (GitHub) for `koomerce-www` and `koomerce-docs` | done 2026-10-19 | Branch `main`, root `/`, build `cd apps/<site> && bun run build`, deploy `cd apps/<site> && npx wrangler deploy`, watch paths limited to the site and its shared packages, build cache on |
| ECR credential helper on koomerce-app (was vextro-app) | done 2026-10-18 | Helper installed, `credHelpers` set for the ECR registry, saved ECR passwords cleared on admin, worker, storefront and backup; `deploy-dokploy.mjs` no longer stores one. Verified: a Dokploy deploy pulls with no stored login |
| Monitoring: uptime checks + Dokploy CPU/RAM alerts | done 2026-10-19 | Email. `apps/monitor` Worker (koomerce-monitor): 5-minute checks, down/up emails; Dokploy notification "Koomerce monitor (email)" posts to it; Dokploy schedule `server-threshold-alerts` emails CPU, memory or disk at 85% (Dokploy self-hosted has no remote-server thresholds) |
| Search Console: keep the verification record; submit both sitemaps | done 2026-10-19 | Domain property koomerce.app (TXT record); both sitemaps submitted |
| Passkeys | done 2026-10-19 | Added on admin.koomerce.app |
| Backups to `koomerce-backup` | owner → agent | Before real customers: check the `backup` app log, fix token scope or bucket name |
| Remove `worker.vioratech.in` | done 2026-10-19 | NEXT_PUBLIC_WORKER_URL moved to api.koomerce.app in all apps, Dokploy domain removed, Hostinger DNS record removed |
| Legal pages: company name, address, grievance officer, retention | owner | The "TEMPLATE" notice stays until filled |

## Later

- Move Hostinger domains (waimers.in, vioratech.in) to Cloudflare DNS.
- Buy `koomerce.in`; ask Afternic about `koomerce.com`.
- Storefront autoscaling: edge caching (`STOREFRONT_EDGE_TTL`) behind Cloudflare for SaaS, k6
  load test, PgBouncer, ECS Fargate, then RDS.
- Turnstile on shopper OTP/login and merchant sign-in; WAF rules on checkout/login (never on
  webhooks).
- Business email app for merchants (receive + reply as their own domain).

## Done

- 2026-10-18: main `afef2ba2` live (admin, storefront); worker at `ff25161` with migrations 0121–0135.
- 2026-10-18: koomerce.app landing + docs on Workers; www → apex 301; Always Use HTTPS.
- 2026-10-18: forms store in D1 with Turnstile and email.
- 2026-10-18: Email Routing for support@; DMARC p=none.
- 2026-10-18: `koomerce-media` + `cdn.koomerce.app` + CORS + `/private/` block; `koomerce-backup`;
  old buckets `sellverse`, `sellverse-backup`, `waimers` deleted by the owner.
- 2026-10-18: admin/api/shops on koomerce.app, env switched, `admin.vioratech.in` redirect.
- 2026-10-18: Dokploy project renamed Vextro → Koomerce; Google OAuth app renamed.
- 2026-10-18: SES identity `koomerce.app` created (DKIM pending DNS).
