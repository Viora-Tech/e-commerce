/** The shopper's "Your data" page, account deletion and the cookie settings link. */
export const privacyContent = {
  title: 'Your data',
  intro:
    'You can ask for a copy of the personal data we hold about you, or delete your account. We answer every request within the time the law gives us.',
  copy: {
    heading: 'Get a copy of your data',
    body: 'We will send you a file with your profile, addresses and orders.',
    button: 'Request a copy',
    sent: 'Request received. We will send the file to you soon.',
    failed: 'Could not send the request. Please try again.',
  },
  requests: {
    heading: 'Your requests',
    kinds: { export: 'Copy of your data', delete: 'Delete your account' },
    statuses: {
      open: 'Received',
      in_progress: 'Being handled',
      completed: 'Done',
      rejected: 'Declined',
    },
    madeOn: (date: string) => `Asked on ${date}`,
  },
  deletion: {
    heading: 'Delete your account',
    body: 'We erase your name, email, mobile number, saved addresses and preferences. We keep order and invoice records only as long as tax law requires. You will be signed out on every device.',
    start: 'Delete my account',
    sendCode: 'Send me a code to confirm',
    sending: 'Sending code',
    codeSent: (where: string) => `We sent a six digit code to ${where}. Enter it to confirm.`,
    code: 'Six digit code',
    reason: 'Anything you would like to tell us? (optional)',
    confirm: 'Delete my account',
    confirming: 'Deleting',
    cancel: 'Keep my account',
    errors: {
      invalid: 'That code is not right. Check it and try again.',
      expired: 'That code has expired. Ask for a new one.',
      locked: 'Too many attempts. Ask for a new code.',
      tooSoon: 'A code was just sent. Wait a few seconds before asking for another.',
      noChannel:
        'We cannot send you a code right now. Please contact the store to delete your account.',
      rateLimited: 'Too many attempts. Please wait a few minutes and try again.',
    },
  },
  deleted: {
    title: 'Your account is being deleted',
    body: 'We have your request and have signed you out everywhere. The store will erase your personal data and keep only what the law requires for invoices.',
    home: 'Back to the store',
  },
  cookieSettings: 'Cookie settings',
} as const
