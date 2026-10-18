# Koomerce launch checklist

Status of the koomerce.app move and the launch work, last updated 2026-10-18. Owner = who does
it ("owner" is the founder, "agent" is a Claude session). Move a line to Done with its date.

## Live setup (2026-10-18)

| What | Where |
| --- | --- |
| Landing site | https://koomerce.app (Cloudflare Workers `koomerce-www`, static export + `/api/forms` Worker) |
| Docs | https://docs.koomerce.app (Cloudflare Workers `koomerce-docs`) |
| Admin | https://admin.koomerce.app (Dokploy project "Koomerce", app `admin`); `admin.vioratech.in` 308-redirects here |
| Worker / webhooks | https://api.koomerce.app and, until every dashboard is moved, https://worker.vioratech.in |
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
| Cloudflare Workers Builds (GitHub) for `koomerce-www` and `koomerce-docs` | owner | Root `apps/www` / `apps/docs`, build `bun install && bun run build`, deploy `bunx wrangler deploy`, branch `main` |
| ECR credential helper on vextro-app | owner (SSH) | IAM role `vextro-app-ecr-pull` is attached; install `amazon-ecr-credential-helper`, set `credHelpers`, then clear the saved ECR passwords in Dokploy |
| Monitoring: uptime checks + Dokploy CPU/RAM alerts | agent | Waiting on Telegram or email |
| Search Console: keep the verification record; submit both sitemaps | owner | No verification TXT or meta tag was found on 2026-10-18 |
| Passkeys | owner | Old ones were for admin.vioratech.in; add new ones on admin.koomerce.app |
| Backups to `koomerce-backup` | owner → agent | Before real customers: check the `backup` app log, fix token scope or bucket name |
| Remove `worker.vioratech.in` | agent | After every provider uses `api.koomerce.app` |
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
