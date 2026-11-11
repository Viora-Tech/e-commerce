/**
 * Email suppression: the customer page's "Email bounced/complained — not sending" notice and the
 * list under Settings › Notifications › Sender email.
 */

type Reason = 'hard_bounce' | 'soft_bounces' | 'complaint'

export const emailSuppressionContent = {
  notice: {
    title: {
      hard_bounce: 'Email bounced — not sending',
      soft_bounces: 'Email keeps bouncing — not sending',
      complaint: 'Email complained — not sending',
    } satisfies Record<Reason, string>,
    body: {
      hard_bounce:
        'This address does not exist or refuses mail, so the shop stopped emailing it. Order and marketing emails are skipped.',
      soft_bounces:
        'Mail to this address failed several times in a row (a full mailbox or a server problem), so the shop stopped emailing it.',
      complaint:
        'The customer marked one of the shop’s emails as spam, so the shop stopped emailing them.',
    } satisfies Record<Reason, string>,
    since: (date: string) => `Since ${date}`,
    detail: 'What their mail server said',
    allowAgain: 'Allow again',
    allowing: 'Allowing…',
    allowed: 'Emails to this customer will go out again.',
    failed: 'Could not allow this address again. Try again.',
    complaintWarning:
      'Only allow again if the customer asked for emails: another spam report hurts every shop’s delivery.',
  },
  list: {
    heading: 'Addresses not receiving email',
    help: 'Addresses that bounced or marked your emails as spam. The shop skips them, so your emails keep reaching inboxes.',
    empty: 'No address has bounced or complained.',
    reason: {
      hard_bounce: 'Bounced',
      soft_bounces: 'Kept bouncing',
      complaint: 'Marked as spam',
    } satisfies Record<Reason, string>,
    columns: { email: 'Email', reason: 'Why', since: 'Since' },
    allowAgain: 'Allow again',
    allowed: (email: string) => `${email} will get emails again.`,
    failed: 'Could not allow this address again. Try again.',
    loadFailed: 'Could not load the list.',
  },
}
