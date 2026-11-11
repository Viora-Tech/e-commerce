/** Settings → Approvals, the role editor's "Needs approval" card, and the "sent for approval" notice. */
export const approvalsContent = {
  title: 'Approvals',
  intro:
    "Changes a member's role sends for approval, from the admin, the AI assistant, AI apps (MCP) or the API. A different member approves them; the person who asked never can. Your own AI app's requests wait here for you to confirm.",
  waiting: {
    heading: 'Waiting for you',
    help: 'Changes from other members, and your own AI app requests. Approve runs the change as you, with your role. Reject throws it away.',
    empty: 'Nothing is waiting for your approval.',
  },
  mine: {
    heading: 'Your requests',
    help: 'What you sent for approval in the last 30 days, and what became of it.',
    empty: 'You have not sent anything for approval.',
  },
  askedBy: (who: string, when: string) => `Asked by ${who} · ${when}`,
  expiresAt: (when: string) => `Expires ${when}`,
  expired: 'Expired: nobody approved it in time, so nothing changed.',
  failed: 'Could not load approvals. Try again.',
  sources: {
    admin: 'Admin',
    assistant: 'AI assistant',
    mcp: 'AI app (MCP)',
    api: 'API token',
    bulkWriter: 'Write with AI',
  } as Record<string, string>,
  /** The notice a member sees when their change was queued instead of made. */
  sent: 'Sent for approval. Nothing has changed yet: it runs once a member who can approve it does so in Settings → Approvals.',
  /** The same change was already waiting, so nothing new was sent. */
  already:
    'Already requested — waiting for approval. The same change is already in Settings → Approvals, so nothing new was sent.',
  /** Title of the calm notice a form shows in place of its red save error (#1531). */
  sentTitle: 'Sent for approval',
  /** Link under that notice. */
  openApprovals: 'Open Settings › Approvals',
  role: {
    heading: 'Needs approval',
    help: 'Ticked actions do not run when a member on this role does them: they wait in Approvals until a different member approves them. Only the owner can change this.',
    empty: 'This role cannot change anything that could need approval.',
    save: 'Save approvals',
    saved: 'Approvals saved',
  },
}
