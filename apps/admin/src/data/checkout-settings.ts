/** Settings → Checkout. */
export const checkoutSettingsContent = {
  title: 'Checkout',
  subtitle: 'What shoppers fill in when they order, and when cash on delivery is offered.',
  contact: {
    heading: 'Contact details',
    phone: 'Mobile number is always asked for',
    phoneHint: 'Couriers call it on delivery. Shoppers type a 10 digit Indian number; we add +91.',
    email: 'Email address',
    emailChoices: {
      required: { label: 'Required', hint: 'Every order gets an email confirmation and receipt.' },
      optional: {
        label: 'Optional',
        hint: 'Faster checkout. Shoppers without an email get updates on WhatsApp or SMS only.',
      },
    },
  },
  address: {
    heading: 'Address',
    pincodeFirst: 'Ask for the PIN code first',
    pincodeFirstHint: 'City and state fill in from the PIN code. Shoppers can still change them.',
    directoryMissing:
      'PIN code lookup data is not installed on this server yet, so shoppers type city and state themselves for now.',
  },
  gstin: {
    heading: 'Business buyers',
    toggle: 'Let buyers add a GSTIN',
    hint: 'An optional field at checkout. We check the number and print it on their GST invoice so they can claim input tax credit.',
  },
  notes: {
    heading: 'Order notes',
    toggle: 'Let shoppers add a note to their order',
    hint: 'For things like "Please call before delivery". You see it on the order.',
  },
  minimum: {
    heading: 'Minimum order value',
    label: 'Smallest order you accept',
    hint: 'Counted after discounts, before shipping. Leave at 0 for no minimum.',
  },
  cod: {
    heading: 'Cash on delivery rules',
    off: 'Cash on delivery is off. Turn it on in Settings → Payments to set these rules.',
    offLink: 'Open Payments',
    feeHint: 'The same fee as in Settings → Payments. A shipping rate can set its own.',
    max: 'Largest order for cash on delivery',
    maxHint: 'Bigger orders must be paid online. Counted with shipping. Leave at 0 for no limit.',
    blocked: 'PIN codes without cash on delivery',
    blockedHint: 'Paste PIN codes, one per line or separated by commas, or upload a CSV file.',
    upload: 'Upload CSV',
    blockedCount: (n: number) => (n === 1 ? '1 PIN code blocked' : `${n} PIN codes blocked`),
    invalid: (list: string) => `These are not PIN codes and were left out: ${list}`,
    tooMany: (max: number) => `You can block up to ${max} PIN codes.`,
    whatsapp: 'Confirm cash on delivery orders on WhatsApp',
    whatsappHint:
      'Coming soon: we will ask the shopper to confirm on WhatsApp before you ship. Turning this on now saves your choice.',
  },
  rupees: '₹',
  save: 'Save',
  saved: 'Checkout settings saved.',
  failed: 'Could not save. Please try again.',
} as const
