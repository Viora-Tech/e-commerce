/** Copy for creating your own store (/onboarding). */
export const onboardingContent = {
  title: 'Create your store',
  name: { label: 'Store name', placeholder: 'e.g. Asha Handlooms' },
  slug: {
    label: 'Store address',
    suffix: (domain: string) => `.${domain}`,
    checking: 'Checking…',
    available: 'Available',
    problem: {
      too_short: 'Too short - use at least 3 characters',
      too_long: 'Too long - use 40 characters or fewer',
      invalid_chars: 'Use lower-case letters, numbers and hyphens only',
      reserved: 'That address is reserved',
      taken: 'That address is already taken',
    },
  },
  shopifyNote: 'Moving from Shopify? You can import your catalogue after setup.',
  submit: 'Create store',
  creating: 'Creating your store…',
  createFailed: 'Could not create your store',
  inviteOnly: {
    heading: 'Signups are invite-only for now',
    body: 'Ask whoever invited you for a fresh link, or check back later.',
  },
} as const
