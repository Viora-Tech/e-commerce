/**
 * Sweep: every router handler states who may call it. Store data is gated with
 * `can(permission)` / `canAny([...])` (`packages/api/src/procedures`); a handler built on
 * bare `storeProcedure` (any member), `protectedProcedure` (any signed-in user) or `base`
 * (anyone) skips the roles check, so each one is listed here with the reason it may.
 *
 * Ratchet: a NEW ungated handler fails until it is gated or listed with a reason; a listed
 * one that is gone (or now gated) fails too, so the list never goes stale. The reasoning for
 * the store-scoped ones lives in docs/guardrails.md, "Router idiom".
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './walk'

type AllowEntry = { site: string; reason: string }

const OWN_ACCOUNT = "the caller's own account (session user only), no store data"
const OWN_MEMBER = "the caller's own row in this store (keyed on scope.userId), nothing store-wide"
const REAUTH = "step-up re-auth (A5) of the caller's own session; people only, no store data"
const NEW_STORE = 'before the user has a store: signing up, creating or joining one'

const ALLOWLIST: AllowEntry[] = [
  { site: '_app.ts: me (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: profile (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: updateProfile (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: stores (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: storesWithApp (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: leaveStore (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: security (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: requestEmailChange (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: confirmEmailChange (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: sessions (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: revokeSession (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: revokeOtherSessions (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: deletion (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: sendDeletionCode (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'account.ts: deleteAccount (protectedProcedure)', reason: OWN_ACCOUNT },
  { site: 'reauth.ts: status (protectedProcedure)', reason: REAUTH },
  { site: 'reauth.ts: sendOtp (protectedProcedure)', reason: REAUTH },
  { site: 'reauth.ts: passkeyOptions (protectedProcedure)', reason: REAUTH },
  { site: 'reauth.ts: verify (protectedProcedure)', reason: REAUTH },
  { site: 'account.ts: notifications (storeProcedure)', reason: OWN_MEMBER },
  { site: 'account.ts: updateNotifications (storeProcedure)', reason: OWN_MEMBER },
  { site: 'appearance.ts: get (storeProcedure)', reason: OWN_MEMBER },
  { site: 'appearance.ts: setMine (storeProcedure)', reason: OWN_MEMBER },
  { site: 'dashboard.ts: tiles (storeProcedure)', reason: OWN_MEMBER },
  { site: 'dashboard.ts: setTiles (storeProcedure)', reason: OWN_MEMBER },
  {
    site: 'bug-reports.ts: list (storeProcedure)',
    reason:
      "the member's own bug reports; the whole store's only for the owner, checked in the handler (scope.isOwner)",
  },
  { site: 'bug-reports.ts: unreadCount (storeProcedure)', reason: OWN_MEMBER },
  { site: 'bug-reports.ts: markSeen (storeProcedure)', reason: OWN_MEMBER },
  {
    site: 'appearance.ts: setStoreDefault (storeProcedure)',
    reason: 'owner-only, checked in the handler (scope.isOwner): not a grain in the roles model',
  },
  {
    site: 'ai.ts: status (storeProcedure)',
    reason: "which AI buttons the caller sees: four booleans from the caller's own role",
  },
  { site: 'staff.ts: me (storeProcedure)', reason: "the caller's own resolved role" },
  {
    site: 'staff.ts: saveRoleApprovals (storeProcedure)',
    reason: 'owner-only, checked in the handler (scope.isOwner)',
  },
  {
    site: 'approvals.ts: waiting (storeProcedure)',
    reason: 'filtered per item by canApprove(); never the requester',
  },
  { site: 'approvals.ts: mine (storeProcedure)', reason: "the caller's own requests only" },
  {
    site: 'approvals.ts: counts (storeProcedure)',
    reason: "badge counts for the caller's own queue",
  },
  {
    site: 'store.ts: origin (storeProcedure)',
    reason: "the store's public web address, which every shopper already sees",
  },
  {
    site: 'customers.ts: lookupPincode (storeProcedure)',
    reason: 'public postal data (PIN → city/state) for address forms, no store data',
  },
  {
    site: 'invitations.ts: preview (base)',
    reason: 'opened from the emailed link before signing in; the id is the secret',
  },
  { site: 'invitations.ts: accept (protectedProcedure)', reason: NEW_STORE },
  { site: 'onboarding.ts: slugAvailability (protectedProcedure)', reason: NEW_STORE },
  { site: 'onboarding.ts: create (protectedProcedure)', reason: NEW_STORE },
  { site: 'onboarding.ts: joinWaitlist (protectedProcedure)', reason: NEW_STORE },
]

const ROUTERS = path.join(ROOT, 'packages/api/src/routers')
const UNGATED = /^\s*['"]?(\w+)['"]?:\s*(storeProcedure|protectedProcedure|base)\b/
const ASSIGNED = /\b(?:const|let)\s+(\w+)\s*=\s*(storeProcedure|protectedProcedure|base)\b/

/** `<file>: <handler> (<builder>)` for every handler built without a permission. */
function ungatedHandlers(): string[] {
  const sites: string[] = []
  for (const file of readdirSync(ROUTERS)
    .filter((f) => f.endsWith('.ts'))
    .sort()) {
    if (file.endsWith('.test.ts')) continue
    for (const line of readFileSync(path.join(ROUTERS, file), 'utf8').split('\n')) {
      const m = UNGATED.exec(line) ?? ASSIGNED.exec(line)
      if (m) sites.push(`${file}: ${m[1]} (${m[2]})`)
    }
  }
  return sites
}

describe('router permissions', () => {
  const found = ungatedHandlers()
  const listed = new Set(ALLOWLIST.map((e) => e.site))

  it('gates every new handler with can()/canAny(), or lists it here with a reason', () => {
    expect(found.filter((s) => !listed.has(s))).toEqual([])
  })

  it('has no stale entries', () => {
    const present = new Set(found)
    expect(ALLOWLIST.filter((e) => !present.has(e.site)).map((e) => e.site)).toEqual([])
  })
})
