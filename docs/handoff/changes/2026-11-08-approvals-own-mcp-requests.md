# Approvals lists the member's own MCP requests (#1263)

A sensitive action an MCP client proposes (refunds, deletes, gift cards...) waits for a person
even for the owner. Those rows are not "Needs approval" rows (`needsApprover` is false: the owner
never has to ask), so Settings → Approvals → Waiting skipped them and they showed only in
Settings → MCP → Activity.

- `listWaitingApprovals` and `approvalCounts` (`services/ai/assistant/activity.ts`) now also read
  the viewer's own `source = 'mcp'` rows; `isOwnMcpRequest` marks them.
- `approvals.waiting` lists them next to other members' requests; the nav badge counts them.
- Unchanged by design: a "Needs approval" request (a staff role ticks the permission) still never
  goes to the member who asked. That is the four-eyes rule in `openFor`; only a different member
  who passes `canApprove` may approve it. Own MCP requests were always confirmable by the asker
  (`ai.approveAction`, result `confirmedAi`), so this only changes where they are listed.
- Other members never see someone else's own MCP request in Approvals.
