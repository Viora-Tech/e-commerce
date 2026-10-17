import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name

export const waitlistContent = {
  title: `Join the ${brand} waitlist`,
  intro:
    'Signups are invite-only for now. Leave your details and we will send you an invite as soon as there is room.',
  close: 'Close',
  email: {
    label: 'Email',
    placeholder: 'you@yourstore.in',
    invalid: 'Enter a valid email address',
  },
  phone: {
    label: 'Phone number',
    placeholder: 'e.g. 98765 43210',
    invalid: 'Enter a valid phone number',
  },
  sell: {
    label: 'What do you sell?',
    placeholder: 'e.g. Handmade cotton sarees',
    invalid: 'Tell us what you sell',
  },
  channels: {
    label: 'Where do you sell now?',
    optional: 'Optional',
    options: ['Own website', 'Instagram or WhatsApp', 'Amazon, Flipkart or Meesho', 'First shop'],
  },
  submit: 'Join the waitlist',
  sending: 'Sending…',
  legalPrefix: 'By joining you agree to our',
  terms: 'Terms',
  and: 'and',
  privacy: 'Privacy policy',
  error: { title: 'Something went wrong', body: 'Could not add you. Try again in a bit.' },
  duplicate: {
    title: 'You’re already on the list',
    body: 'We’ll email you as soon as there is room.',
  },
  success: {
    title: 'You are on the list',
    body: 'We will email you an invite as soon as there is room.',
    nextTitle: 'What happens next',
    steps: [
      {
        title: 'We review your details',
        body: 'We look at what you sell so we can set you up right.',
      },
      { title: 'You get an invite email', body: 'Your sign-up link arrives in your inbox.' },
      { title: 'Create your store', body: 'Your email and phone are already filled in.' },
    ],
    shareLabel: 'Know someone who sells? Share your link',
    copy: 'Copy link',
    copied: 'Link copied',
    done: 'Done',
    shareOnWhatsApp: 'Share on WhatsApp',
    backHome: 'Back to home',
    whatsappShare: `Run your store in plain words with ${brand}:`,
  },
  hero: {
    placeholder: 'you@yourstore.in',
    emailLabel: 'Your email',
    below: 'Invite-only for now · free to join',
    howItWorks: 'See how it works →',
    joinShort: 'Join',
  },
}

export type WaitlistStatus = 'idle' | 'success' | 'invalid' | 'duplicate' | 'error'

export type WaitlistState = {
  status: WaitlistStatus
  errors: { email?: string; phone?: string; sell?: string }
}

export const WAITLIST_INITIAL: WaitlistState = { status: 'idle', errors: {} }
