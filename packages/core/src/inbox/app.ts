/** SOURCE OF TRUTH: the Inbox app manifest — WHAT: the built-in, free "Inbox" app (our Shopify Inbox): chat with shoppers on the storefront and answer from the admin, with their cart, orders and discounts at hand. Installed from the App Store (not pre-installed, owner 2026-10-24); once installed it is a sales channel (`admin.salesChannel`), its pages under Sales channels / WHY: the App Store catalogue, Installed apps and the sidebar read apps from manifests. Free because it is absent from `APP_PRICING`. Imported by commerce.config.ts. Design: docs/superpowers/specs/2026-10-24-inbox-design.md. */
import { definePlugin } from '@commerce/plugins'
import { INBOX_APP_ID } from './constants'

/** Where the channel lives in the admin (`routes.salesChannels.inbox*`). */
export const INBOX_CHANNEL_PATH = '/sales-channels/inbox'

/**
 * Inbox: a chat button on every storefront page, replies from the admin in real time, product,
 * discount and image cards, quick replies, assignment, and the shopper's cart beside the chat.
 * Our own tables and realtime (no third party); the Chatwoot app stays as an alternative, and
 * when both are installed only Inbox's chat is drawn.
 */
export const inboxPlugin = definePlugin({
  id: INBOX_APP_ID,
  name: 'Inbox',
  version: '1.0.0',
  kind: 'builtin',
  category: 'messages',
  description:
    'Chat with shoppers while they browse: answer questions about size, COD and delivery from your admin, and share products and discount codes in the chat.',
  listing: {
    tagline: 'Live chat on your store that sells: answer, share products and codes, see the cart.',
    highlights: [
      'A chat button on every page, in your theme’s colours, for guests and signed-in shoppers',
      'Replies arrive at once; typing and seen marks on both sides',
      'Share products (Add to cart in the chat), discount codes (applied for them) and images',
      'Quick replies, assignment to your team, business hours and an away message',
      'The shopper’s live cart and orders beside the conversation',
    ],
    guide: '/merchant-guide/apps/inbox',
    worksWith: ['Every theme, including imported Shopify themes', 'English and Hindi'],
    keywords: ['chat', 'live chat', 'inbox', 'support', 'shopify inbox', 'messages', 'whatsapp'],
  },
  access: {
    resources: [
      {
        resource: 'customers',
        level: 'read-write',
        why: 'Links each conversation to the shopper who signed in',
      },
      { resource: 'orders', level: 'read', why: 'Shows a signed-in shopper’s orders to your team' },
      { resource: 'products', level: 'read', why: 'Product cards you share in a chat' },
      { resource: 'discounts', level: 'read', why: 'Discount codes you share in a chat' },
    ],
    summary: 'runs your store chat',
  },
  provides: {},
  admin: {
    icon: 'MessageSquare',
    salesChannel: INBOX_CHANNEL_PATH,
  },
})
