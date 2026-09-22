/** Copy for the accept-invitation page. */
export const invitationContent = {
  title: (store: string) => `Join ${store}`,
  invitedBy: (name: string) => `${name} invited you to help run this store.`,
  invitedAnon: 'You have been invited to help run this store.',
  role: (role: string) => `You will join as ${role}.`,
  email: 'Email',
  emailLocked: 'The invitation is for this address.',
  sendCode: 'Send code',
  code: (email: string) => `Code sent to ${email}`,
  codeHelp: 'In development the code is printed in the admin server log.',
  accept: 'Accept invitation',
  signInAndAccept: 'Sign in and join',
  sendFailed: 'Could not send the code',
  wrongCode: 'Wrong code',
  acceptFailed: 'Could not accept the invitation',
  otherAccount: {
    heading: 'Signed in with another account',
    body: (current: string, invited: string) =>
      `You are signed in as ${current}, but this invitation is for ${invited}. Sign out, then open the link again.`,
    signOut: 'Sign out',
  },
  states: {
    missing: {
      heading: 'Invitation not found',
      body: 'The link may be wrong, or the store no longer exists. Ask whoever invited you to send it again.',
    },
    accepted: {
      heading: 'Already accepted',
      body: 'This invitation has been used. Log in to open the store.',
    },
    cancelled: {
      heading: 'Invitation cancelled',
      body: 'This invitation was withdrawn. Ask the store owner for a new one.',
    },
    expired: {
      heading: 'Invitation expired',
      body: 'This invitation is past its expiry. Ask the store owner to send a new one.',
    },
  },
  goToLogin: 'Go to log in',
} as const
