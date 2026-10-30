# Security tracker: Cloudflare edge hardening status (I-02/I-03/I-04)

Docs-only update to `docs/security/2026-10-24-infra-pentest.md`, recording edge changes already
made live on Cloudflare (zone `koomerce.app`) on 28 Oct:

- **I-03 → FIXED:** SSL mode set to **Full (Strict)** (safe because every proxied hostname
  terminates on a valid cert — the tunnel, R2, or edge Workers). Verified live (apex 200, admin
  307, no 525/526 handshake errors).
- **HSTS enabled:** `max-age=31536000; includeSubDomains; nosniff`, `preload` deliberately OFF
  (one-way door; needs owner sign-off before hstspreload.org submission).
- **I-04 → Bot Fight Mode held:** on the Free plan it is domain-wide and cannot be Skip-exempted,
  so it would challenge payment/courier webhooks, SES callbacks, mobile/API clients and the MCP
  link on `api.koomerce.app`. Needs Super Bot Fight Mode (Pro) or an explicit owner go. The auth
  rate-limit rule stays the live edge control.

No code changes.
