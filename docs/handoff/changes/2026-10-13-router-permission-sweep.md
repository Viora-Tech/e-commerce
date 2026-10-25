# Sweep: every API handler states who may call it

New `scripts/sweeps/router-permissions.test.ts` (runs in `bun run test:sweeps`). Router handlers
built on bare `storeProcedure` (any member), `protectedProcedure` (any signed-in user) or `base`
(anyone) skip the roles check. Each such handler must be listed in the sweep's allowlist with a
reason, or the sweep fails. Listed entries that disappear or become gated also fail, so the list
can't go stale.

Baseline: 28 handlers, all self-scoped (own account, own member row), public by design
(invitation preview by link, PIN lookup, store address) or pre-store (onboarding).

Part of the pre-launch code audit, permissions pass. The same pass found no gaps in:
- the store procedure's per-request permission read;
- admin route handlers (uploads, dev OTP is hard-off in production, Razorpay OAuth callback);
- the storefront proxy's trusted headers (stripped and re-derived on every request);
- payment and courier webhook signatures (fail closed, constant-time compare, Cashfree replay window).
