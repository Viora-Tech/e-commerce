/** Copy for the Decentro app (Apps → Decentro). */
export const decentroAppContent = {
  connect: {
    title: 'Connect Decentro',
    intro:
      'Take UPI payments through Decentro. Shoppers scan a QR code on a computer or tap their UPI app on a phone, and the order is marked paid on its own.',
    signupUrl: 'https://decentro.tech/signup/',
    supportEmail: 'pgsupport@decentro.tech',
    openSignup: 'Open Decentro sign-up',
    steps: {
      one: {
        title: 'Get your Decentro keys',
        body: 'Decentro sends your Client ID, Client secret and Consumer URN by email once they set up your account. Test keys come first; live keys come after Decentro approves your business.',
        note: 'Already have an account? Look for the email from Decentro with your keys. If you cannot find it, ask your Decentro account manager.',
      },
      two: {
        title: 'Paste them below',
        body: 'Pick Test or Live to match the keys, fill in the three boxes, then press "Test connection".',
      },
      three: {
        title: 'Turn on payment updates',
        body: 'In your Decentro dashboard, open Configurations, then Callback configurations. Paste the address, the header name and the secret from "Payment updates" below. Without this, orders still turn paid, just a little slower.',
      },
    },
    mode: {
      label: 'Mode',
      test: 'Test',
      live: 'Live',
      help: {
        test: "Using Decentro's test system. No real money moves. Use your test keys here.",
        live: 'Using your live Decentro account. Real UPI payments from real shoppers.',
      },
    },
    fields: {
      clientId: {
        label: 'Client ID',
        help: 'From the email Decentro sent you. It looks like a short name, not a password.',
      },
      clientSecret: {
        label: 'Client secret',
        help: 'From the same email. Keep it private: we store it locked and never show it again.',
      },
      consumerUrn: {
        label: 'Consumer URN',
        help: 'A long code of letters and numbers that Decentro gave you for taking payments.',
      },
    },
    testConnection: 'Test connection',
    testing: 'Testing…',
    testHint:
      'We ask Decentro to look up a payment that does not exist. Nothing is created and no money moves.',
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
    saveLabel: 'Save and turn on',
    saved: 'Decentro is on',
    saveFailed: 'Could not save',
    unsaved: 'Unsaved changes',
    discard: 'Discard',
    callback: {
      heading: 'Payment updates',
      intro:
        'Decentro tells your store the moment a shopper pays. Copy these two into Decentro: Configurations, then Callback configurations.',
      urlLabel: 'Callback URL',
      urlHelp:
        'Your store must be on a public web address for Decentro to reach it; localhost does not work.',
      headerName: 'x-webhook-token',
      headersLabel: 'Headers',
      headersHelp:
        'Paste this whole block into the headers box. The long code is your secret: updates without it are refused.',
      secretCopyNow: 'Copy it now: once saved, it is hidden.',
      secretSaved:
        'The secret is saved and hidden. Lost it? Make a new one, save, and paste the new block into Decentro.',
      /** Stands in for the hidden secret once saved. */
      secretHidden: 'your saved secret',
      newSecret: 'Make a new secret',
    },
    advanced: {
      trigger: 'Advanced',
      payoutUrnLabel: 'Payouts consumer URN (optional)',
      payoutUrnHelp:
        'Only if Decentro gave you a separate code for payouts. Used to send a refund to a UPI ID when a normal refund is not possible.',
    },
  },
  overview: {
    title: 'Decentro',
    subtitle: 'UPI payments by QR code or UPI app, with refunds back to UPI.',
    notConnected: 'Not connected yet. Add your Decentro keys to start taking UPI payments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    mode: { test: 'Test mode', live: 'Live' },
    manage: 'Change keys or settings',
    paymentsCta: 'Open Settings → Payments',
    capabilitiesHeading: 'What this app can do',
    capabilities: [
      'Show a UPI QR code on computers, and Google Pay, PhonePe and Paytm buttons on phones',
      'Mark the order paid on its own when Decentro confirms the payment',
      'Check Decentro for the latest status when an update is late',
      'Refund all or part of a payment back to the shopper’s UPI ID',
      'Send a refund as a UPI payout from your Decentro balance, when needed',
    ],
    limitsHeading: 'Good to know',
    limits: [
      'UPI only: cards and netbanking need another way to get paid, like Razorpay or Cashfree.',
      'Decentro takes payments from ₹5. Your Decentro plan may set a higher upper limit.',
      'A QR code stays open for 30 minutes. After that the shopper asks for a new one.',
    ],
  },
}
