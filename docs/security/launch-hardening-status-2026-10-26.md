# Launch security hardening — status & go-criteria (2026-10-26)

Tracks the push from "secure at launch (B+)" toward A+ after the 2026-10-26 launch. Two code PRs
shipped the parts that are safe to ship now; the infra items below are **deliberately gated** —
each one can break the live site or its email if flipped prematurely, so each has an explicit
go-criterion, not a date.

## Shipped (code)

- **CI is now a merge gate** — PR #797 (`security/ci-gate`). The DB-backed security tests
  (cross-store RLS leak test, payment webhook underpayment guard) run on every PR and push to
  `dev`/`main`; memory-capped so the runner finishes. *Merge once its own run is green.*
- **Checkout/account origin isolation, phase A** — PR #798
  (`security/checkout-origin-isolation`). `frame-ancestors 'none'` + COOP/CORP/XFO on
  checkout/account (audit D-01). *Phase B (separate origin) is designed but not a launch-day
  cutover — see its handoff doc.*

## Gated infra items (do NOT flip on launch day)

### DMARC `quarantine` → `reject`
- **Current (verified 2026-10-26):** `_dmarc.koomerce.app` = `p=quarantine; pct=100;
  rua=mailto:support@koomerce.app; fo=1`. Correct posture, aggregate reporting on.
- **Why not reject yet:** the platform sends from `no-reply@mail.koomerce.app` via Amazon SES, but
  `mail.koomerce.app` has **no SPF record and no custom SES MAIL FROM**, and the root SPF
  (`v=spf1 include:_spf.mx.cloudflare.net ~all`) does not include SES. So SES mail can pass DMARC
  **only by DKIM alignment**. If any legit source fails DKIM, `reject` would bounce real order/OTP
  email.
- **Go-criterion:** read ~1 week of `rua` reports (support@koomerce.app). When **every** legitimate
  sending source — platform SES (`mail.koomerce.app`) and each active merchant sender domain —
  shows `dmarc=pass`, flip to `p=reject`.
- **Defense-in-depth to add first (safe, do before reject):** set a custom MAIL FROM subdomain on
  each SES identity (e.g. `bounce.mail.koomerce.app`) with its own `v=spf1 include:amazonses.com
  ~all` + MX, so SPF aligns too and DKIM isn't the only path. Confirm each identity's DKIM CNAMEs
  are present and valid.
- **Who:** DNS changes are owner-facing (Cloudflare). The Cloudflare MCP was unreachable this
  session; make these in the Cloudflare dashboard or via a working MCP connection.

### Cloudflare Tunnel phase 2 — origin port lock (I-01)
- **Current:** the `cloudflared` connector is live on the prod origin (fixes I-01/I-03 in principle),
  but DNS still resolves to the origin IP (`13.205.25.249`) and the origin's public 80/443 are
  still open — so the lock isn't enforced yet.
- **Why not now:** closing the public ports **before** DNS is fully cut over to the tunnel takes the
  live site down. Order of operations matters.
- **Go-criterion / steps:** (1) cut each production hostname's DNS to the tunnel (proxied), (2)
  confirm traffic serves through the tunnel for every host, (3) *then* restrict the AWS security
  group so 80/443 accept only Cloudflare ranges (or only the tunnel), (4) verify from an off-Cloudflare
  client that the origin IP no longer serves. Do in a low-traffic window with a rollback ready.

### Secrets → AWS Secrets Manager (I-07)
- **Current:** secrets live in Dokploy env config (no secret value in git — verified 25 Oct);
  residual risk Low (2FA-gated access).
- **Why not now:** the `SETTINGS_SECRET` decrypt path must not be touched blind on launch eve, and
  this is sequenced to the EC2→Lightsail move when secrets are provisioned fresh anyway.
- **Steps:** already written as **§F of `docs/security/secret-rotation-runbook.md`** (instance-role
  read, entrypoint injection that is a no-op until `AWS_SECRETS_MANAGER_SECRET_ID` is set, then
  rotate `SETTINGS_SECRET`). Execute during the Lightsail cutover.

## Outside eyes (#4)
Scoping brief for an external pentest written: `docs/security/pentest-scope-2026.md`. Interim
automated scanning (ZAP/Burp authenticated, Trivy on ECR images, Observatory, enumeration/auth-spike
alerting) listed in §7 there. Owner to pick a firm/program (§8).

## Still open from audit D-items (architectural, owner decisions)
- **D-01 phase B** — separate origin for checkout/account.
- **D-02** — move admin off a storefront's registrable domain.
- **D-04** — bug-report screenshots at public URLs: private repo + signed short-lived URLs + add to
  erasure. Needs an owner decision.
