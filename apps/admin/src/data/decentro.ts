/** Copy for the Decentro app (Apps → Decentro). */
export const decentroAppContent = {
  connect: {
    title: 'Connect Decentro',
    intro:
      'Take UPI payments through Decentro. Shoppers scan a QR code or tap a UPI link, and the order is marked paid on its own.',
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
        body: 'Email Decentro support with the payment updates address and the secret from "Advanced" below. Ask them to send the secret in the x-webhook-token header. Until they do, payments are confirmed more slowly, when we next check with Decentro.',
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
    advanced: {
      trigger: 'Advanced',
      flowLabel: 'How shoppers pay',
      flows: {
        qr: 'Show a QR code (best on computers)',
        link: "Open the shopper's UPI app (best on phones)",
      },
      flowHelp:
        'The QR code is shown on the order page after checkout. Either way the order is marked paid on its own.',
      webhookSecretLabel: 'Callback secret',
      webhookSecretHelp:
        'Decentro must send this in the x-webhook-token header of every payment update. Updates without it are refused.',
      webhookSecretCopyNow: 'Copy it now: once saved, it is hidden.',
      webhookSecretSaved:
        'It is saved and hidden. Lost it? Make a new one, save, and send it to Decentro again.',
      newSecret: 'Make a new secret',
      webhookUrlLabel: 'Payment updates address',
      webhookUrlHelp:
        'Send this address to Decentro support. It only works once your store is on a public domain; Decentro cannot reach localhost.',
      payoutUrnLabel: 'Payouts consumer URN (optional)',
      payoutUrnHelp:
        'Only if Decentro gave you a separate code for payouts. Used to send a refund to a UPI ID when a normal refund is not possible.',
      copy: 'Copy',
      copied: 'Copied',
    },
  },
  overview: {
    title: 'Decentro',
    subtitle: 'UPI payments by QR code or UPI link, with refunds back to UPI.',
    notConnected: 'Not connected yet. Add your Decentro keys to start taking UPI payments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    connectedAndTested: 'Connected ✓ tested',
    mode: { test: 'Test mode', live: 'Live' },
    manage: 'Change keys or settings',
    paymentsCta: 'Open Settings → Payments',
    capabilitiesHeading: 'What this app can do',
    capabilities: [
      'Show a UPI QR code for the exact order amount, or open the shopper’s UPI app',
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
