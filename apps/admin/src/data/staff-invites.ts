/** Copy for the Pending invites list on Settings → Staff, and the invite email outcome. */
export const staffInvitesContent = {
  heading: 'Pending invites',
  intro: 'People you invited who have not joined yet. Invites last 2 days.',
  empty: 'No pending invites. When you invite someone, they show up here until they join.',
  columns: {
    person: 'Email',
    role: 'Role',
    sent: 'Sent',
    expires: 'Expires',
  },
  invitedBy: (email: string) => `Invited by ${email}`,
  /** Invites made before roles were recorded join with the least access. */
  defaultRole: 'Staff',
  expired: 'Expired',
  actions: {
    menu: 'Invite actions',
    copy: 'Copy invite link',
    resend: 'Resend email',
    resendShort: 'Resend',
    cancel: 'Cancel invite',
  },
  copied: 'Invite link copied. Send it to them yourself.',
  copyFailed: 'Could not copy the link',
  resent: (email: string) => `Invite sent again to ${email}`,
  cancelled: 'Invite cancelled',
  emailFailed: "Couldn't send the invite email",
  emailFailedHelp:
    'The invite is saved under Pending invites. Copy its link and send it yourself, or try Resend email later.',
  failed: 'Something went wrong. Please try again.',
  loadFailed: 'Could not load pending invites',
  confirmCancel: {
    title: 'Cancel this invite?',
    body: (email: string) => `The link sent to ${email} stops working straight away.`,
    confirm: 'Cancel invite',
    keep: 'Keep invite',
  },
} as const
