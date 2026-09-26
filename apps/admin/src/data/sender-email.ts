/** Settings → Notifications → Sender email: every word the card shows. */

type Reason =
  | 'empty'
  | 'invalid'
  | 'free_mail'
  | 'platform_domain'
  | 'too_long'
  | 'domain_taken'
  | 'provider_failed'

export type DnsProviderId = 'cloudflare' | 'godaddy' | 'hostinger' | 'namecheap'

export const senderEmailContent = {
  heading: 'Sender email',
  help: 'The address your customers see on every email from your shop.',
  form: {
    emailLabel: 'Send emails from',
    emailPlaceholder: 'support@yourshop.in',
    emailHelp: 'An address at your own website domain. Replies from customers go here.',
    nameLabel: 'Sender name',
    nameHelp: (storeName: string) =>
      storeName
        ? `Leave empty to use your shop name, ${storeName}.`
        : 'Leave empty to use your shop name.',
    save: 'Save and get DNS records',
    saving: 'Saving…',
    change: 'Change address',
    cancel: 'Cancel',
    changeWarning:
      'A new domain has to be checked again. Until then, emails go out from our address.',
  },
  now: {
    label: 'Customers see',
    from: 'From',
    replyTo: 'Replies go to',
    platformNote:
      'Your emails go out from our address until your domain is checked. Nothing stops working meanwhile.',
    ownNote: 'Your emails go out from your own address.',
    devNote: 'Development: no email is really sent from this computer.',
  },
  ownApp:
    'Your own Amazon SES app is on, so it sends your emails from the address saved there. This address is used if you switch that app off.',
  status: {
    pending: 'Waiting for DNS',
    verified: 'Verified',
    failed: 'Not verified',
  },
  statusHelp: {
    pending:
      'Add the records below where you bought your domain. Checking can take a few minutes, sometimes up to a day. We keep checking for you.',
    verified: 'All set. Emails now come from your own address.',
    failed: 'We could not verify your domain.',
  },
  reasons: {
    records_not_found:
      'We could not find the records yet. Check that each one was added exactly as shown.',
    wrong_value:
      'A record is there but its value is different. Copy the value again and paste it in full.',
    dns_unreachable: 'Your domain’s DNS did not answer. Try again in a little while.',
    provider_error: 'Our email service had a hiccup. Try again in a little while.',
    timed_out:
      'The records were not found within 3 days, so the check stopped. Press Check now to start again.',
  } as Record<string, string>,
  checkedAt: (when: string) => `Last checked ${when}`,
  checkNow: 'Check now',
  checking: 'Checking…',
  remove: 'Stop using this address',
  removeConfirm: 'Stop sending from this address? Emails go out from our address again.',
  removed: 'Emails now go out from our address.',
  saved: 'Saved. Now add the DNS records below.',
  verifiedToast: 'Your domain is verified. Emails now come from your own address.',
  stillPending: 'Not verified yet. We will keep checking.',
  restarted: 'We started the check again. The records below are new: replace the old ones.',
  errors: {
    empty: 'Enter an email address.',
    invalid: 'That does not look like an email address. Example: support@yourshop.in',
    free_mail:
      'Gmail, Yahoo and similar addresses cannot be used, because you cannot change their DNS. Use an address at your own domain.',
    platform_domain: 'That address belongs to the platform. Use an address at your own domain.',
    too_long: 'That address is too long.',
    domain_taken:
      'This domain is already used by another shop. If it is yours, contact support and we will sort it out.',
    provider_failed: 'We could not start checking the domain. Please try again in a minute.',
    generic: 'Something went wrong. Please try again.',
  } satisfies Record<Reason | 'generic', string>,
  records: {
    heading: 'Add these DNS records',
    help: 'Log in where you bought your domain, open its DNS settings and add each record below. Copy each value with the button next to it.',
    columns: { type: 'Type', name: 'Name', value: 'Value' },
    fullName: (name: string) => `Full name: ${name}`,
    priority: (p: number) => `Priority ${p}`,
    purpose: {
      dkim: 'Required',
      mailFrom: 'Recommended',
      dmarc: 'Recommended',
    },
    dmarcNote: 'Skip the _dmarc record if your domain already has one. Never add two.',
  },
  where: {
    trigger: 'Where do I add these?',
    title: 'Where to add DNS records',
    intro: 'Pick the company where you bought your domain.',
    other:
      'Another company? Look for “DNS”, “DNS zone” or “Manage DNS” in your domain settings. Their support team can add the records for you if you send them this table.',
    providers: {
      cloudflare: {
        name: 'Cloudflare',
        steps: [
          'Log in to Cloudflare and click your domain.',
          'Open DNS, then Records, and click Add record.',
          'Choose the Type, paste the Name and the Value (for MX, also the priority).',
          'For CNAME records, turn the orange cloud off (DNS only). Then Save.',
        ],
      },
      godaddy: {
        name: 'GoDaddy',
        steps: [
          'Log in to GoDaddy and open My Products, then your domain.',
          'Click DNS, then Add New Record.',
          'Choose the Type, paste the Name into Name and the Value into Value (or Data).',
          'Leave TTL as it is and Save. Repeat for each record.',
        ],
      },
      hostinger: {
        name: 'Hostinger',
        steps: [
          'Log in to hPanel and open Domains, then your domain.',
          'Open DNS / Nameservers, then DNS records.',
          'Choose the Type, paste the Name and the Value, then Add Record.',
          'If Hostinger already shows a record with the same name and type, edit it instead of adding a second.',
        ],
      },
      namecheap: {
        name: 'Namecheap',
        steps: [
          'Log in to Namecheap, open Domain List and click Manage next to your domain.',
          'Open Advanced DNS and click Add New Record.',
          'Choose the Type, paste the Name into Host and the Value into Value (or Target).',
          'Click the green tick to save. MX records sit under Mail Settings: choose Custom MX.',
        ],
      },
    } satisfies Record<DnsProviderId, { name: string; steps: string[] }>,
  },
  spam: {
    trigger: 'Why emails might land in spam',
    title: 'Why emails might land in spam',
    points: [
      'Your domain is not verified yet. Add the DNS records above; verified email is trusted much more.',
      'The _dmarc record is missing. Big inboxes like Gmail and Yahoo look for it.',
      'Emails that look like ads: all capitals, lots of “FREE” or “!!!”, or one big image with no text.',
      'Sending offers to people who did not ask for them. Only email customers who agreed to hear from you.',
      'Many customers mark your emails as spam or the addresses do not exist. Keep your customer list clean.',
    ],
    footer: 'Order emails (confirmations, shipping updates) are the least likely to be filtered.',
  },
} as const
