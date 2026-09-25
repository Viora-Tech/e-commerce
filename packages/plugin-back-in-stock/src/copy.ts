/** Copy for the "Notify me" app block (Add panel → Apps). Never inline this in the block. */
export const notifyMeBlockCopy = {
  buttonLabel: 'Notify me',
  helperText: "We'll email you the moment it's back in stock.",
  emailLabel: 'Email address',
  emailPlaceholder: 'you@example.com',
  whatsappLabel: 'WhatsApp number (optional)',
  whatsappPlaceholder: '98765 43210',
  consent: "We'll email you once when this is back in stock. Unsubscribe anytime.",
  submitting: 'Sending…',
  doneEmail: "Check your inbox — confirm the alert and we'll let you know.",
  errorGeneric: 'Something went wrong. Try again in a moment.',
  errorRateLimited: 'Too many requests. Try again shortly.',
} as const
