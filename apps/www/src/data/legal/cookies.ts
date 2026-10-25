import { siteConfig } from '@commerce/config/site'
import { type LegalDoc, sections } from './types'

const domain = siteConfig.brand.domain

export const cookiesDoc: LegalDoc = {
  slug: 'cookies',
  title: 'Cookie policy',
  description: `Which cookies ${domain} uses and how to choose.`,
  lead: `Which cookies ${domain} uses and how to choose.`,
  readMinutes: 4,
  sections: sections([
    {
      title: 'What cookies are',
      plain: ['Tiny files your browser keeps.', 'They help the site remember you.'],
      body: ['Small files a website stores in your browser to remember things between visits.'],
    },
    {
      title: 'Necessary cookies',
      plain: ['Needed for sign-in and security.', 'Always on.'],
      body: [
        'Keep you signed in, protect forms and remember your cookie choices. They are always on.',
      ],
    },
    {
      title: 'Analytics cookies',
      plain: ['Tell us which pages are useful.', 'Off unless you turn them on.'],
      body: [
        'Help us understand which pages are used so we can improve them. Off until you allow them.',
      ],
    },
    {
      title: 'Marketing cookies',
      plain: ['Measure our ads.', 'Off unless you turn them on.'],
      body: ['Measure our ads and campaigns. Off until you allow them.'],
    },
    {
      title: 'Changing your choice',
      plain: ['Change your mind any time.', 'From the footer of any page.'],
      body: ['Open Cookie preferences in the footer at any time.'],
      callout: {
        title: 'Rejecting is as easy as accepting.',
        text: 'Both buttons sit side by side, same size.',
      },
    },
    {
      title: 'List of cookies',
      plain: ['Today this site sets one cookie of its own.', 'It remembers your cookie choice.'],
      body: [
        'cookie_consent: set by us, necessary, remembers your cookie choice, kept for 1 year.',
        `${domain} loads no analytics or marketing cookies today. If we add any, they appear here first and stay off until you allow them.`,
        'Cloudflare, which serves this site, may set a short-lived security cookie (such as __cf_bm) to filter bots, and its Turnstile check on our forms runs from challenges.cloudflare.com.',
      ],
    },
  ]),
}
