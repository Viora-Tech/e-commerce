/**
 * Settings → Approvals: changes a member's role sends for approval ("Needs approval" on the
 * role), from the admin, the AI assistant, MCP or the API. Approve and Reject are
 * `ai.approveAction` / `ai.cancelAction` (the same rules: never the asker, `canApprove`).
 * Any member may open the page: approvers see what waits, everyone sees their own requests.
 * A member's own AI app (MCP) requests are listed under Waiting too: those are theirs to confirm
 * (#1263). A "Needs approval" request still never goes to the member who asked for it.
 */

import { isPermission } from '@commerce/core/permissions'
import { storeProcedure } from '../procedures'
import { canApprove } from '../procedures/approval-rules'
import {
  approvalCounts,
  isOwnMcpRequest,
  listMyRequests,
  listWaitingApprovals,
} from '../services/ai/assistant/activity'

export const approvalsRouter = {
  /** Waiting changes this member may decide, and recently expired ones (marked expired). */
  waiting: storeProcedure.handler(async ({ context }) => {
    const { userId } = context.scope
    const all = await listWaitingApprovals(
      { storeId: context.scope.storeId, tx: context.tx },
      userId,
    )
    return all.filter(
      (v) =>
        isOwnMcpRequest(v, userId) ||
        (v.needsApprover &&
          v.requestedById !== userId &&
          canApprove(
            context.scope,
            v.permission && isPermission(v.permission) ? v.permission : null,
          )),
    )
  }),

  /** The member's own requests and their outcomes; opening it clears the outcome badge. */
  mine: storeProcedure.handler(({ context }) =>
    listMyRequests({ storeId: context.scope.storeId, tx: context.tx }, context.scope.userId),
  ),

  /** The nav badge: waiting for this member, plus unseen outcomes of their own requests. */
  counts: storeProcedure.handler(({ context }) =>
    approvalCounts({ storeId: context.scope.storeId, tx: context.tx }, context.scope),
  ),
}
