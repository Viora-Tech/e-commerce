/** Copy for Apps → WhatsApp → "Connect with Facebook" (WhatsApp Embedded Signup). */
export const whatsappSignupContent = {
  title: 'Connect in one step',
  intro:
    'Sign in with Facebook and pick or create your WhatsApp Business account and number. We fill in the details below for you.',
  connect: 'Connect with Facebook',
  connectApp: 'I use the WhatsApp Business app',
  appHelp:
    'Already chatting with customers in the WhatsApp Business app? Use "I use the WhatsApp Business app" to keep the app and your chats on your phone while Koomerce sends order messages from the same number.',
  connecting: 'Finishing in Facebook…',
  saving: 'Connecting your number…',
  connected: 'WhatsApp connected',
  cancelled: 'WhatsApp sign-up was closed before it finished.',
  failed: 'WhatsApp could not be connected. Try again.',
  blocked: 'Facebook did not open. Allow pop-ups for this page and try again.',
  manual: 'Or fill in the details yourself below.',
  account: 'Connected account',
  number: 'Number',
  name: 'Display name',
  quality: 'Quality',
  connectedOn: 'Connected',
  disconnect: 'Disconnect',
  disconnected: 'WhatsApp disconnected',
  status: {
    active: 'Working',
    restricted: 'Restricted by Meta',
    disabled: 'Disabled by Meta',
    disconnected: 'Removed in Meta',
  } as Record<string, string>,
  statusHelp:
    'Meta changed this account. Open WhatsApp Manager to see why, then connect again if needed.',
  notRegistered:
    'Meta did not register this number for sending yet. In WhatsApp Manager, open the number and finish its registration, then connect again.',
  lastFailure: 'Last failed message',
  lastTemplate: 'Last template update',
  billing:
    'Meta bills WhatsApp messages to your WhatsApp Business account. Add a payment method in WhatsApp Manager (in rupees) so messages keep sending.',
}
