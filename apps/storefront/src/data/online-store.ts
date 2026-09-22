/** Copy for the storefront's password page, theme preview bar and cookie banner. */
export const passwordContent = {
  title: 'Opening soon',
  label: 'Enter store using password',
  password: 'Password',
  submit: 'Enter',
  wrong: 'That password is not right. Try again.',
  owner: 'Are you the store owner?',
  ownerLink: 'Sign in to your admin',
} as const

export const previewBarContent = {
  label: (name: string) => `Previewing ${name}`,
  hint: 'Only you can see this theme. Shoppers see your live theme.',
  exit: 'Exit preview',
} as const

export const consentContent = {
  label: 'Cookie consent',
  heading: 'Your privacy',
  body: 'We use necessary cookies to run this store, like your cart. With your consent we also use analytics cookies to understand visits and marketing cookies to measure ads. You can change your mind any time by clearing cookies for this site.',
  acceptAll: 'Accept all',
  rejectAll: 'Necessary only',
  customise: 'Choose',
  save: 'Save choices',
  categories: {
    necessary: { label: 'Necessary', body: 'Cart, checkout and security. Always on.' },
    analytics: { label: 'Analytics', body: 'Counts visits and pages so the store can improve.' },
    marketing: { label: 'Marketing', body: 'Measures ads on Meta and other platforms.' },
  },
} as const
