/**
 * Grants a call needs on top of its own `can(permission)`, read from what it was asked to do:
 * `orders.setStatus` to `cancelled` also needs `orders.cancel`, a cancel that refunds also
 * `orders.refund`. Declared on the procedure (`can(permission, also)`), never checked inside
 * the handler, so the same change asks the same of every entry point: refused without the
 * grant, and held in Settings → Approvals when the member's role ticks it, before anything is
 * written (`storeProcedureWith` in `store.ts`). A grant checked inside a handler would skip
 * that hold: the orders table's cancel ran at once while the order page's waited (#1409).
 */
import type { Permission } from '@commerce/core/permissions'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'

/**
 * `input` is the call's input as sent, before the procedure's schema reads it: read it
 * defensively (`inputField`). A wrong shape needs nothing extra; the schema then refuses it.
 */
export type AlsoNeeds = (
  input: unknown,
  at: { tx: StoreTx; storeId: string },
) => readonly Permission[] | Promise<readonly Permission[]>

/** `input.key` when `input` is an object, else undefined: for `AlsoNeeds` readers. */
export function inputField(input: unknown, key: string): unknown {
  return input && typeof input === 'object' ? (input as Record<string, unknown>)[key] : undefined
}

/** "orders.refund" reads as "refund orders" in the message a merchant sees. */
export function describePermission(permission: Permission): string {
  const [resource, action] = permission.split('.')
  return `${action} ${String(resource).replace(/_/g, ' ')}`
}

/** The extra grants this call needs; refuses when the member lacks one. */
export async function alsoHeld(
  scope: { can: (p: Permission) => boolean; roleSlug: string },
  also: AlsoNeeds,
  input: unknown,
  at: { tx: StoreTx; storeId: string },
): Promise<readonly Permission[]> {
  const extra = await also(input, at)
  const missing = extra.find((p) => !scope.can(p))
  if (missing) {
    throw new ORPCError('FORBIDDEN', {
      message: `Your role does not allow ${describePermission(missing)}`,
      data: { required: missing, role: scope.roleSlug },
    })
  }
  return extra
}
