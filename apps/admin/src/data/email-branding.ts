/**
 * Copy for Settings → Notifications → Email branding (owner, 22 Nov 2026, Shopify's "Customize
 * email templates"): the logo, its size and the colours every email uses.
 */
export const emailBrandingContent = {
  title: 'Email branding',
  intro:
    'Your logo and colours for every email customers get. Start from your theme and change what you like.',
  back: 'Notifications',
  open: 'Customize',
  openHelp: 'Logo, logo size and colours for every email.',
  logo: {
    title: 'Logo',
    choose: 'Choose logo',
    change: 'Change',
    remove: 'Remove',
    none: 'No logo: the store name is shown instead.',
    pickTitle: 'Choose your email logo',
    pickHelp: 'A PNG or JPG works in every inbox. Upload or pick from your files.',
    size: 'Logo size',
    px: (n: number) => `${n}px`,
  },
  colours: {
    title: 'Colours',
    accent: 'Buttons and links',
    onAccent: 'Text on buttons',
  },
  preview: {
    title: 'Preview',
    help: 'Filled with a sample order. Nothing is sent.',
    previous: 'Previous email',
    next: 'Next email',
    loading: 'Drawing the email…',
    failed: 'Could not draw the preview.',
    frameTitle: (name: string) => `Email preview of ${name}`,
  },
  save: {
    message: 'Unsaved branding',
    save: 'Save',
    discard: 'Discard',
    saved: 'Branding saved. Every email uses it from now on.',
    failed: 'Could not save the branding. Try again.',
  },
  reset: {
    action: 'Use my theme',
    title: 'Go back to your theme’s look?',
    body: 'Your own logo and colours for emails are removed. Emails follow your theme again.',
    confirm: 'Use my theme',
    keep: 'Keep my branding',
    done: 'Emails follow your theme again.',
  },
  loadFailed: 'Could not load the email branding.',
}
