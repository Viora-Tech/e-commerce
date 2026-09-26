/**
 * Copy for Settings → Notifications and the email / WhatsApp Connect pages.
 * Plain words for a shop owner: what each message is, when it goes, and how
 * messages are sent.
 */

export type MessageGroupId =
  | 'orders'
  | 'transfer'
  | 'preorder'
  | 'manual'
  | 'account'
  | 'app'
  | 'you'

export type ChannelId = 'email' | 'whatsapp'

export const notificationsSettingsContent = {
  title: 'Notifications',
  intro: 'The messages your customers get from your shop, and how they are sent.',
  whatsThis: {
    trigger: "What's this?",
    title: 'Messages to your customers',
    body: 'When someone orders, pays or their parcel ships, your shop sends them a short message by email, and by WhatsApp if you connect it. You choose which ones go out. You can look at each one before it is sent.',
  },

  status: {
    ready: 'Your customers get order messages by email.',
    readyWhatsapp: 'Your customers get order messages by email and WhatsApp.',
    notReady: 'Customer messages are not being sent yet.',
    notReadyHelp: 'Connect an email app so customers hear from you when they order.',
    connectEmail: 'Connect email',
  },

  list: {
    heading: 'Messages your customers get',
    help: 'Turn off any message you do not want to send. Everything is on to begin with.',
    on: 'On',
    off: 'Off',
    switchLabel: (name: string) => `Send "${name}"`,
    preview: 'Preview',
    sendTest: 'Send me a test',
    sending: 'Sending…',
    saved: (name: string, on: boolean) => (on ? `"${name}" turned on` : `"${name}" turned off`),
    saveFailed: 'Could not save. Please try again.',
    manualBadge: 'When you click Send',
    alwaysBadge: 'Always sent',
    appBadge: 'Set in the app',
    openApp: 'Open app',
    notYet: {
      heading: 'Not sent yet',
      body: 'Customers do not get a message yet when their parcel is out for delivery, delivered, has a delivery problem, or when an order is cancelled or refunded. These are coming.',
    },
  },

  groups: {
    orders: { title: 'Orders', help: 'Sent by themselves as the order moves along.' },
    transfer: {
      title: 'UPI or bank transfer orders',
      help: 'For orders paid by UPI QR or bank transfer that you check yourself.',
    },
    preorder: {
      title: 'Pre-orders',
      help: 'For pre-orders where the customer pays a deposit first.',
    },
    manual: {
      title: 'Sent only when you choose',
      help: 'These go out when you click Send on an order or cart. Nothing is sent by itself.',
    },
    account: {
      title: 'Always sent',
      help: 'Your shop needs these to work, so they cannot be turned off.',
    },
    app: {
      title: 'From your apps',
      help: 'Apps you installed send these. Change them in the app.',
    },
    you: {
      title: 'Messages you get',
      help: 'Sent to your shop email address, not to customers.',
    },
  } satisfies Record<MessageGroupId, { title: string; help: string }>,

  /** Every message, in plain words. Keys are the template ids the server sends. */
  messages: {
    order_placed: { name: 'Order confirmation', when: 'Right after a customer places an order.' },
    payment_received: {
      name: 'Payment received',
      when: 'When the payment comes in or you mark the order paid.',
    },
    order_shipped: {
      name: 'Order shipped',
      when: 'When you ship the order. Includes the tracking link.',
    },
    unpaid_cancelled: {
      name: 'Order cancelled for not paying',
      when: 'When an unpaid UPI or bank transfer order is cancelled.',
    },
    balance_request: {
      name: 'Pay the rest (pre-order)',
      when: 'When a pre-order is ready and the rest of the money is due.',
    },
    balance_reminder: {
      name: 'Reminder to pay the rest',
      when: 'If the rest of a pre-order is still unpaid.',
    },
    balance_received: {
      name: 'Rest of payment received',
      when: 'When the customer pays the rest of a pre-order.',
    },
    payment_reminder: {
      name: 'Reminder to pay (UPI or bank transfer)',
      when: 'When you click "Send reminder" on an unpaid order.',
    },
    draft_invoice: {
      name: 'Invoice with a pay link',
      when: 'When you send an invoice from a draft order.',
    },
    checkout_recovery: {
      name: 'Left items in their cart',
      when: 'When you click "Send reminder" on an abandoned cart.',
    },
    document_copy: {
      name: 'Copy of an invoice',
      when: 'When you email an invoice or credit note from an order.',
    },
    login_code: {
      name: 'Sign-in code',
      when: 'When a customer signs in to their account on your shop.',
    },
    gift_card_issued: {
      name: 'Gift card',
      when: 'When a gift card is bought or you send one. Carries the code.',
    },
    back_in_stock_confirm: {
      name: 'Back in stock: confirm',
      when: 'When a customer asks to hear when an item is back.',
    },
    back_in_stock_alert: {
      name: 'Back in stock',
      when: 'When the item they asked about is back in stock.',
    },
    unpaid_cancel_notice: {
      name: 'Unpaid order will be cancelled',
      when: 'Before an unpaid UPI or bank transfer order is cancelled for you.',
    },
  } as Record<string, { name: string; when: string }>,

  channelNames: { email: 'Email', whatsapp: 'WhatsApp' } satisfies Record<ChannelId, string>,

  preview: {
    title: (name: string) => `Preview: ${name}`,
    help: 'Filled with a sample order so you can see how it looks. Nothing is sent.',
    subject: 'Subject',
    email: 'Email',
    whatsapp: 'WhatsApp',
    loading: 'Loading preview…',
    failed: 'Could not load the preview.',
    close: 'Close',
    frameTitle: (name: string) => `Email preview of ${name}`,
  },

  test: {
    sent: (to: string) => `Test sent to ${to}. Check your inbox in a minute.`,
    sentLog: 'Test written to the developer log (no email is sent in development).',
    failed: 'The test could not be sent.',
    noChannel: 'Connect an email app first, then you can send yourself a test.',
    noChannelTitle: 'No way to send yet',
  },

  sending: {
    heading: 'How messages are sent',
    help: 'Your shop sends messages through these apps. Connect one to start sending.',
    email: {
      name: 'Email',
      via: 'Amazon SES app',
      help: 'Sends order emails from your own email address. Very low cost.',
    },
    whatsapp: {
      name: 'WhatsApp',
      via: 'WhatsApp app',
      help: 'Sends order updates to the customer’s WhatsApp. Needs a WhatsApp Business account.',
    },
    state: {
      connected: 'Connected',
      installed: 'Not connected yet',
      missing: 'Not set up',
      platform: 'On',
    },
    platformHelp:
      'Sent for you, from your sender email once it is verified. Connect your own Amazon SES only if you want to.',
    useOwn: 'Use my own Amazon SES',
    testMode:
      'Test mode is on: WhatsApp only reaches people who messaged your shop in the last day.',
    connect: 'Connect',
    manage: 'Manage',
    installFailed: 'Could not add the app. Please try again.',
  },

  advanced: {
    heading: 'Advanced',
    help: 'Developer tools',
    devLog: 'Developer log',
    devLogHelp:
      'Prints every message to the server console instead of sending it. Only in development.',
    devLogOn: 'Developer log turned on',
    devLogOff: 'Developer log turned off',
    emailsPreview: 'All email designs',
  },

  help: {
    label: 'Need help? Message us on WhatsApp',
    soon: 'WhatsApp help is coming soon. For now, email support.',
  },
} as const

/** Plain three-step guides on the email and WhatsApp Connect pages. */
export const messageAppsContent = {
  ses: {
    title: 'Connect email',
    intro: 'Send order emails to your customers through Amazon SES.',
    steps: [
      'Sign in to Amazon Web Services and open SES (Simple Email Service).',
      'Verify the email address (or domain) you want to send from.',
      'Create an access key for sending email and paste the details below. Then switch it on and save.',
    ],
    note: 'New Amazon SES accounts can only email verified addresses until Amazon lifts the limit. Ask Amazon for "production access" when you are ready.',
  },
  whatsapp: {
    title: 'Connect WhatsApp',
    intro: 'Send order updates to your customers on WhatsApp.',
    steps: [
      'Open Meta Business Manager and set up WhatsApp Business for your shop number.',
      'Create message templates named order_placed, payment_received and order_shipped, and wait for Meta to approve them.',
      'Paste your phone number ID and access token below. Then switch it on and save.',
    ],
    note: 'Until your templates are approved, tick test mode to send plain text. It only reaches people who messaged your shop in the last day.',
  },
  stepsLabel: 'How to connect',
  back: 'Notifications',
} as const
