# App attack catalog & test plan — 2026-10-30

Owner-authorized security testing of **our own** platform (koomerce.app). This is the
app-layer companion to `2026-10-24-infra-pentest.md` (edge/infra) and the Sept/Oct app
audits. Goal: enumerate every attack class relevant to our stack, mark what we test, and
turn the testable ones into a regression suite.

**Rules of engagement**
- Target **local dev** or a dedicated test deploy — never production, never real customer data.
- No third-party targets, no real-data exfiltration, no destructive runs outside the test DB.
- Every simulated attack lives inside our own vitest/Playwright harness and doubles as a
  regression test for the fix.

**Stack under test:** admin + storefront + api (Next.js 16), better-auth (merchant +
customer), Postgres with RLS multi-tenant isolation, drizzle, R2 media, Cloudflare edge,
payment gateways, courier providers, the koomerce MCP server, AI gateway.

Legend — **Test:** ✅ build now · 🟡 needs live/dev target · ⛔ out of scope/covered elsewhere

---

## 1. Authentication & session
| # | Attack | Applies here | Test |
|---|--------|--------------|------|
| A1 | Session cookie replay (stolen/cloned cookie reused elsewhere) | Session not bound to device/IP; 30-day sliding expiry | ✅ |
| A2 | Replay from new IP / country | We trust `cf-connecting-ip`; no anomaly action today | ✅ |
| A3 | Replay after revocation | Revoke exists; verify it bites within cookie-cache window (5 min) | ✅ |
| A4 | Session fixation (pre-set cookie survives login) | better-auth should rotate on login — verify | ✅ |
| A5 | No step-up for sensitive actions (gateway keys, staff, payouts, deletes) | None today — biggest gap | ✅ |
| A6 | OTP brute force / no lockout | 6-digit OTP, 10-min expiry; edge rate-limit live | ✅ |
| A7 | OTP / login code reuse or race (parallel redeem) | Verify single-use + atomic | ✅ |
| A8 | Password/passkey downgrade or reviewer-login bypass | Reviewer endpoint gated; verify it's off in prod config | ✅ |
| A9 | Account-linking takeover (Google link to unverified email) | `allowDifferentEmails:false`, no trusted providers — verify | ✅ |
| A10 | Open-redirect on auth callback (`disableOriginCheck:false`) | Verify callback can't bounce to another site | ✅ |

## 2. Authorization / access control (crown jewels — multi-tenant)
| # | Attack | Applies here | Test |
|---|--------|--------------|------|
| B1 | **Cross-tenant data read** (store A reads store B via forged `x-store-id` / IDOR) | RLS is the control; must hold under forged headers & direct IDs | ✅ |
| B2 | **Cross-tenant write** (mutate another store's rows) | Same — RLS write path | ✅ |
| B3 | IDOR on order/customer/invoice by sequential id | A-00 class (fixed for orders via view token) — re-verify across resources | ✅ |
| B4 | Privilege escalation (staff → owner, role tampering) | Roles/permissions table; verify server-side enforcement | ✅ |
| B5 | Missing function-level authz (admin API called without the right role) | Per-procedure `protectedProcedure` + role checks | ✅ |
| B6 | Tenant context confusion (background job / worker runs as wrong store) | Worker + importers set store context | 🟡 |

## 3. Injection
| # | Attack | Applies here | Test |
|---|--------|--------------|------|
| C1 | SQL injection | drizzle parameterizes; test raw/`sql.unsafe` call sites + search/filter inputs | ✅ |
| C2 | Stored/reflected XSS (product titles, notes, reviews, blog, metafields) | Strict CSP live; verify no sink renders unescaped HTML | ✅ |
| C3 | SSTI / template injection (liquid themes, email templates) | Liquid rendering is sandboxed — verify no server-context escape | ✅ |
| C4 | Header / log injection (CRLF, forged `x-store-id`, host header) | Overlaps B1; host-header trust | ✅ |
| C5 | NoSQL/command/path injection | Redis keys, file paths (R2 keys), any shell-out | ✅ |
| C6 | Prompt injection into the AI gateway / MCP (store text as instructions) | MCP treats store text as data — verify it can't drive actions | ✅ |

## 4. Request forgery
| # | Attack | Applies here | Test |
|---|--------|--------------|------|
| D1 | CSRF on mutating endpoints | SameSite=Lax + origin check; verify cross-origin POST blocked | ✅ |
| D2 | SSRF (image import by URL, webhook URLs, Shopify import, pincode/courier lookups) | URL-fetching features must block internal targets (169.254.*, metadata) | ✅ |
| D3 | Clickjacking | `frame-ancestors 'self'` + `X-Frame-Options` confirmed live | ⛔ done |

## 5. Business logic (e-commerce specific)
| # | Attack | Applies here | Test |
|---|--------|--------------|------|
| E1 | Price / cart tampering (negative qty, client-set price, currency swap) | Price must be server-authoritative | ✅ |
| E2 | Coupon/discount abuse (stacking, reuse past limit, race) | discount_usage limits + rate-limit | ✅ |
| E3 | Payment bypass / order-paid without capture (forged gateway callback) | Verify webhook signature + server-side state machine | ✅ |
| E4 | Refund/balance manipulation (negative, over-refund) | `balanceOf` invariant — refund never puts customer in debt | ✅ |
| E5 | Inventory oversell / race at checkout | Stock decrement atomicity | ✅ |
| E6 | Gift card / wallet balance abuse | Single-use, atomic debit | ✅ |
| E7 | Free shipping / tax evasion via zone/pincode spoof | Server recomputes shipping/tax | ✅ |

## 6. File upload / media
| # | Attack | Applies here | Test |
|---|--------|--------------|------|
| F1 | Malicious upload (SVG with script, polyglot, oversized) | Served with `default-src 'none'; sandbox` CSP — re-verify | ✅ |
| F2 | Path traversal / overwrite via R2 key | Key sanitization | ✅ |
| F3 | Public-bucket PII exposure | I-06 (mitigated) | ⛔ done |

## 7. API abuse & enumeration
| # | Attack | Applies here | Test |
|---|--------|--------------|------|
| G1 | User/email/store enumeration via error or timing diffs | Login/OTP/invite responses | ✅ |
| G2 | Rate-limit bypass / mass scraping of product/customer APIs | Edge rate-limit on auth only — API scraping open | 🟡 |
| G3 | Mass assignment (extra fields in API body set protected columns) | drizzle insert/update allowlists | ✅ |
| G4 | GraphQL/tRPC introspection / batching abuse | orpc endpoints | ✅ |

## 8. Transport / infra (covered — see infra pentest)
| # | Attack | Status |
|---|--------|--------|
| H1 | TLS downgrade / sniff | ⛔ I-02 fixed (TLS 1.2+, HSTS) |
| H2 | Origin impersonation / direct-to-origin | ⛔ I-01/I-03 (tunnel + Full Strict) |
| H3 | DMARC spoof / phishing | 🟡 I-05 (quarantine → reject pending) |
| H4 | DDoS | ⛔ Cloudflare + reviewed in infra pentest §D |

## 9. Client-side & supply chain
| # | Attack | Applies here | Test |
|---|--------|--------------|------|
| I1 | Dependency / SCA vulns | `bun audit` + lockfile review | ✅ |
| I2 | Secrets in client bundle / source maps | grep built output for keys | ✅ |
| I3 | Subresource integrity / CDN tampering | third-party scripts | 🟡 |
| I4 | Prototype pollution via JSON inputs | parse paths | ✅ |

---

## Execution plan
1. **Phase 1 (✅ now):** build `security/` test suites (vitest + a small Playwright pass)
   covering every ✅ row against **local dev**. Each test asserts the *current* behavior and
   is tagged `EXPECTED-PASS` (control holds) or `KNOWN-GAP` (documents the hole).
2. **Phase 2:** triage results into a findings table here, severity-rated, same taxonomy as
   the audits.
3. **Phase 3:** fix `KNOWN-GAP` items by severity (step-up auth A5 and session binding A1/A2
   first), each flipping its test to `EXPECTED-PASS`.
4. **Phase 3 (🟡):** the ones needing a live target (API scraping G2, worker tenant context
   B6, SRI I3) run against the dev deploy with your go-ahead.

## Findings

### Class A — session/authn (run 2026-10-30, `packages/auth/test/session-attacks.test.ts`, 7/7)
**Controls confirmed holding:**
- A3 — sign-out invalidates the cookie server-side (verified with cookie-cache bypassed).
- A3 — `revokeOtherSessions` ("sign out other devices") instantly kills a remote session.
- A4 — session fixation prevented: a planted `session_token` is ignored; login mints a fresh token.
- A6 — OTP brute force capped: after a burst of wrong guesses the genuine code is also rejected
  (better-auth `emailOTP` attempt cap) — on top of the edge rate-limit on `/otp`.
- A7 — OTP single-use: a consumed code cannot be replayed.

**Confirmed gaps (severity in app-audit taxonomy):**
| Ref | Gap | Severity | Note |
|-----|-----|----------|------|
| A1 | Session is bearer-only — a cloned cookie authenticates from any client/IP/device | **Medium** | No device/session binding; 30-day sliding expiry widens the window |
| A2 | No IP on sessions → no "same session, new country" detection | **Low** | By design (D-01 won't trust client IP); revisit once behind trusted CF proxy |
| A5 | No step-up (re-auth) for sensitive actions (gateway keys, staff, payouts, deletes) | **Medium** | Known from code review; API-package test pending |

**Recommended fixes (by value):** A5 step-up re-auth (OTP/passkey within ~10 min for sensitive
mutations) → A1 shorter admin session + idle timeout (e.g. 7-day hard cap, ~12h idle) →
A2 bind/alert on session anomalies once `trustedProxy='cloudflare'` is the norm.

### Class I — supply chain / SCA (run 2026-10-30, `bun audit`)
Raw count 58 (2 critical, 26 high, 20 moderate, 10 low) — but triage by workspace + prod/dev
is what matters. Money path = storefront/admin/api/worker runtime; everything else is dev/docs.

| Prio | Package | Severity | Chain | Reality | Fix |
|------|---------|----------|-------|---------|-----|
| 🔴 1 | **better-auth** | **Critical+High** | `@commerce/{auth,core,admin}` | Our real auth lib; **Google social sign-in is on**. "OAuth state as Magic Link → sign in as another user" + "OAuth Proxy → sign in as another user" = **account takeover on the money path** | Bump **1.7.6 → 1.7.14** (vuln range `>=1.6.17 <1.7.7`; patch-level, low risk). Also `@better-auth/passkey` to matching latest |
| 🟠 2 | **sanitize-html** `<2.18.0` | Moderate+Low | `@commerce/blocks` | Runtime HTML sanitizer for embed blocks; `javascript:`/`noscript` XSS bypasses | Bump to ≥2.18.0 |
| 🟡 3 | **shadcn** `^4.13.0` | (pulls ~26 highs) | `@commerce/admin` **dependency** | A build-time CLI shipped as a prod dep; drags in puppeteer-core, systeminformation (Win cmd-injection), fast-uri, MCP SDK | **Move to devDependencies** → ~26 "vulns" leave the prod surface at once |
| ⚪ 4 | **dompurify** (mermaid) | Critical | `@commerce/docs` | Docs site, build-time diagram render only; not customer-facing runtime | Bump with Nextra/mermaid when convenient |

**Takeaway:** the only launch-critical item is **better-auth** (account takeover). `shadcn`→dev and
`sanitize-html` are quick wins; dompurify/mermaid is docs-only.

**FIXED 30 Oct:**
- **better-auth** `1.7.6 → 1.7.14` (+ `@better-auth/passkey`) in auth/core/admin — closes the OAuth
  account-takeover critical+high. Verified: auth suite 30/30, typecheck clean.
- **zod** `→ 4.6.7` (floor raised to `^4.6.7` across all 18 manifests) — closes the HIGH
  memory-exhaustion DoS (`<4.6.6`). This was a *second* direct finding the new gate surfaced that
  the manual audits had missed. Verified: core business-logic 58/58.
- **Release gate added:** `scripts/security-audit.ts` (`bun run audit`), wired into the release
  checklist. Blocks on a high/critical whose advisory our declared version floor can still reach;
  transitive + floored-safe copies are warnings. This is the control that turns point-in-time
  auditing into a per-release check. Still deferred (not launch-critical): `shadcn`→devDeps,
  `sanitize-html` bump, dompurify/mermaid (docs-only).

### Class B — authorization / multi-tenant (verified 2026-10-30)
- B1/B2 cross-tenant read+write: `packages/api/test/cross-store-leak.test.ts` walks the whole
  oRPC router + storefront loaders with store B's ids; `packages/db/test/rls-isolation.test.ts`
  (+ rls-coverage) proves the DB role sees nothing without a store context and RLS blocks a
  cross-store insert. **7/7 RLS pass.** Strongest control in the app.
- B3 order IDOR: `apps/storefront/src/lib/order-access.test.ts` (view-token required).

### Class E — business logic (verified 2026-10-30, 58 + adapter tests pass)
| Ref | Attack | Verdict | Evidence |
|-----|--------|---------|----------|
| E1 | Price / cart tampering | **DEFENDED** | `cart.ts addToCart` snapshots `v.pricePaise` server-side (client sends only variantId+qty); storefront action clamps `Math.max(1, qty)`; `setLineQuantity` treats `≤0` as delete → no negative subtotal |
| E3 | Forged / unsigned / tampered payment webhook | **DEFENDED** | `describePaymentProvider` conformance on every adapter: bad-sig & tampered → `ok:false`, constant-time `safeEqual`. Razorpay 55 / Cashfree 59 / Decentro 41 green |
| E3b | Validly-signed but underpaid capture | **DEFENDED** | amount invariant in `applyPaymentStatus`; order stays unpaid, mismatch recorded (`webhook.test.ts`) |
| E2 | Discount / coupon abuse | **Covered** | `discounts/evaluate.test.ts` + `order/place-order.test.ts` (usage limits at order time) |
| E4 | Over-refund / negative refund | **Covered** | `balanceOf` invariant in `order-fulfil.service.ts` ("a refund never puts the customer in debt") + `gift-cards/service.test.ts` |

**No app-code gaps found in Class E** — payment, pricing and refund paths are server-authoritative
and contract-tested. (E5 oversell race / E6 gift-card double-spend / E7 shipping-tax spoof not
individually re-probed; covered by the above suites.)

### Classes C & D — injection / SSRF (verified 2026-10-30)
| Ref | Attack | Verdict | Evidence |
|-----|--------|---------|----------|
| D2 | SSRF via user-supplied URL (CSV/Shopify image import, review photos, theme import, HTTP automation) | **DEFENDED** | `packages/core/src/net/safe-fetch.ts` blocks private/loopback/**169.254 metadata**/CGNAT/reserved, re-checks every redirect, drops auth headers cross-host, caps time+bytes. **24 guard tests pass.** Wired into media-rehost, shopify-import/media, reviews/photos, theme-import, automations/http. CSV import only *stores* URLs; the fetch is the guarded rehost path |
| C1 | SQL injection | **DEFENDED** | drizzle parameterizes; `sql.raw` sites are compile-time enum constants (`oneOf`) or charset-gated (`automation-cutover` nodeIds pass `/^[A-Za-z0-9_-]{1,40}$/` before interpolation — quotes can't survive) |

**Residual (honest):** safeFetch accepts a small DNS-rebinding window (documented; redirect/scheme/
literal-IP holes are closed). `automation-cutover` building a SQL array by string is safe today but
would be cleaner as a bound array param — **Low/informational hardening**, not a finding.

### Classes C2/C6, F, G — still pending (recommend tools over hand-written tests)
Stored/reflected XSS (C2 — product/review/blog render under the strict CSP already live),
prompt-injection into the koomerce MCP/AI (C6 — MCP already treats store text as data), upload
(F1 SVG/polyglot, F2 R2 key traversal), enumeration + mass-assignment (G1/G3). These are breadth
checks best run with **Semgrep (SAST)** and **Akto against the dev API**, which cover far more
input permutations than bespoke tests.

---

## Overall verdict (2026-10-30)
App-layer posture is **strong**: multi-tenant isolation, session controls, payment/webhook, and
business-logic money paths are all either contract-tested or confirmed server-authoritative. The
**only launch-critical finding is the `better-auth` OAuth account-takeover (SCA I-prio-1)** — a
patch bump. Session gaps (A1 binding, A5 step-up) are Medium hardening, not launch blockers.
