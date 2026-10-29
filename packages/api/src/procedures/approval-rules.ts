/**
 * Who waits and who approves, for a role's "Needs approval" ticks. Kept apart from `store.ts`
 * so the approval service can use the rules without importing the procedure builders.
 */
import { type Permission, permissions } from '@commerce/core/permissions'

type Scope = {
  isOwner: boolean
  needsApproval: Permission[]
  can: (permission: Permission) => boolean
}

/** The member's role ticks "Needs approval" for this permission: their change waits. */
export function mustAsk(scope: Pick<Scope, 'isOwner' | 'needsApproval'>, p: Permission): boolean {
  return !scope.isOwner && scope.needsApproval.includes(p)
}

/**
 * May approve someone else's change that needs `p`: the owner, or a member holding
 * `approvals.manage` and `p` whose own role does not tick `p` (else they could approve for
 * others what they may not do alone). Never the asker: callers check that separately. A null
 * `p` (an admin action whose permission only its procedure knows) is checked when it runs.
 */
export function canApprove(scope: Scope, p: Permission | null): boolean {
  if (scope.isOwner) return true
  if (!scope.can(permissions.APPROVALS_MANAGE)) return false
  return p === null || (scope.can(p) && !scope.needsApproval.includes(p))
}
