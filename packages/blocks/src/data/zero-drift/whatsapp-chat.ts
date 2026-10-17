/** Copy and defaults for the WhatsApp chat button (Figma Section / WhatsApp chat button). */
export const whatsappChatContent = {
  label: 'WhatsApp chat button',
  defaults: {
    number: '',
    name: 'Support',
    replyTime: 'Typically replies in 10 min',
    greeting: 'Hi! Need help choosing a product or tracking an order?',
    message: 'Hi, I have a question.',
    button: 'Chat with us',
    start: 'Start chat on WhatsApp',
  },
  fields: {
    number: 'WhatsApp number (with country code, e.g. 919876543210)',
    name: 'Name on the card',
    replyTime: 'Reply time',
    greeting: 'Greeting',
    message: 'Message the chat starts with',
    button: 'Button text',
    start: 'Card button text',
  },
  close: 'Close chat',
  open: 'Open chat',
  editorNote: 'Add your WhatsApp number to show the chat button on your store.',
} as const
