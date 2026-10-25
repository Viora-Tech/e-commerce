import { siteConfig } from '@commerce/config/site'

export const consentContent = {
  bannerTitle: `Cookies on ${siteConfig.brand.domain}`,
  bannerBody:
    'We use necessary cookies to run this site. With your OK we also use analytics and marketing cookies.',
  policyLink: 'Read the Cookie policy.',
  preferences: 'Preferences',
  rejectNonEssential: 'Reject non-essential',
  acceptAll: 'Accept all',
  saveChoices: 'Save choices',
  modalTitle: 'Cookie preferences',
  modalIntro: 'Choose which cookies we can use. You can change this any time from the footer.',
  close: 'Close',
  alwaysOn: 'Always on',
  categories: [
    {
      key: 'necessary',
      title: 'Necessary',
      body: 'Sign-in, security and remembering your cookie choice. The site can’t work without these.',
    },
    {
      key: 'analytics',
      title: 'Analytics',
      body: 'Help us see which pages are used so we can improve them.',
    },
    {
      key: 'marketing',
      title: 'Marketing',
      body: 'Measure our ads and campaigns on other sites.',
    },
  ],
} as const
