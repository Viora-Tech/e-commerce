/** Default copy, field labels and fixed UI strings for the cookie banner (Zero Drift `cookie-banner`). */
export const cookieBannerContent = {
  label: 'Cookie banner',
  regionLabel: 'Cookie consent',
  message:
    '<p>We use cookies to run the store, remember what is in your cart and understand how the site is used. You choose what else we may use them for.</p>',
  policyLabel: 'Read our privacy policy',
  acceptLabel: 'Accept all',
  declineLabel: 'Decline',
  preferencesLabel: 'Choose cookies',
  save: 'Save choices',
  categories: {
    necessary: { label: 'Necessary', body: 'Cart, checkout and security. Always on.' },
    analytics: {
      label: 'Analytics',
      body: 'Counts visits and pages, and where visitors came from, so the store can improve.',
    },
    marketing: { label: 'Marketing', body: 'Measures ads on Meta and other platforms.' },
  },
  positionOptions: [
    { label: 'Bar across the bottom', value: 'bar' },
    { label: 'Card, bottom left', value: 'left' },
    { label: 'Card, bottom right', value: 'right' },
  ],
  showHide: [
    { label: 'Show', value: true },
    { label: 'Hide', value: false },
  ],
  fields: {
    position: 'Position',
    message: 'Message (Settings → Customer privacy text wins when set)',
    policyLink: 'Privacy policy link',
    policyLabel: 'Privacy policy link text',
    acceptLabel: 'Accept button',
    declineLabel: 'Decline button',
    showPreferences: 'Let shoppers choose categories',
    preferencesLabel: 'Choose link text',
    delay: 'Wait before showing (seconds, 0-20)',
  },
} as const
