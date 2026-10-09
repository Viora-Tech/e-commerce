import type {
  AutomationStepType,
  AutomationTemplateId,
  AutomationTrigger,
  ConditionField,
  MarketingRunStatus,
} from '@commerce/core/marketing'

/** Copy for Marketing > Automations: the list, the templates and the editor. */
export const automationsContent = {
  title: 'Automations',
  intro: 'Messages that send themselves when a shopper does something, and stop when they buy.',
  templatesTitle: 'Start from a template',
  templatesIntro:
    'Every template is editable after you create it. New automations start switched off.',
  use: 'Use template',
  inUse: (n: number) => (n === 1 ? '1 in use' : `${n} in use`),
  listTitle: 'Your automations',
  empty: 'No automations yet. Pick a template below to start.',
  columns: {
    name: 'Automation',
    status: 'Status',
    runs: 'Shoppers',
    sent: 'Sent',
    clickRate: 'Click rate',
    orders: 'Orders',
    sales: 'Sales',
  },
  status: { active: 'On', paused: 'Off' },
  created: 'Automation created. Review it, then switch it on.',
  browseNote:
    'Browse abandonment needs product views tied to a known shopper, which the storefront does not record yet.',
  triggers: {
    checkout_abandoned: 'Shopper leaves checkout after entering an email or phone',
    cart_abandoned: 'Signed-in shopper leaves products in the cart',
    customer_subscribed: 'Someone subscribes to email marketing',
    first_order: 'Customer places their first order',
    customer_lapsed: 'Customer has not ordered for a while',
    cod_order_placed: 'Customer places a cash-on-delivery order',
  } satisfies Record<AutomationTrigger, string>,
  templateChannels: {
    abandoned_checkout: 'Email, WhatsApp',
    abandoned_cart: 'Email',
    welcome_subscriber: 'Email',
    first_purchase: 'Email',
    win_back: 'Email',
    cod_confirmation: 'WhatsApp',
  } satisfies Record<AutomationTemplateId, string>,
} as const

export const automationEditorContent = {
  breadcrumb: 'Automations',
  saveBar: { message: 'Unsaved automation', save: 'Save', discard: 'Discard' },
  on: 'On',
  off: 'Off',
  turnedOn: 'Automation is on. It starts with the next shopper who qualifies.',
  turnedOff: 'Automation is off. Shoppers already in it wait where they are.',
  saved: 'Automation saved',
  deleted: 'Automation deleted',
  failed: 'Could not save the automation',
  delete: {
    action: 'Delete',
    title: 'Delete this automation?',
    body: 'Shoppers in it stop receiving messages and its results are removed. This cannot be undone.',
    confirm: 'Delete automation',
    cancel: 'Keep it',
  },
  name: 'Name',
  tiles: {
    runs: 'Shoppers entered',
    active: 'In progress',
    sent: 'Messages sent',
    clicked: 'Clicked',
    converted: 'Converted',
    sales: 'Sales',
  },
  flow: {
    trigger: 'Trigger',
    settings: 'Step settings',
    pickStep: 'Pick a step in the flow to change it.',
    wait: (label: string) => `Wait ${label}`,
    noTemplate: 'Pick a WhatsApp template',
    noSubject: 'Write a subject',
    condition: (field: string, op: string, value: string) => `${field} is ${op} ${value}`,
  },
  convertedHelp: 'Ordered while in the sequence; the sequence stopped there.',
  trigger: {
    title: 'Trigger',
    afterMinutes: 'Count the basket as abandoned after',
    lapsedDays: 'Days since the last order',
    audience: 'Who receives it',
    audienceConsent:
      'Only customers who said yes to marketing on that channel (email or WhatsApp). Everyone else is skipped. Customers give or withdraw consent at checkout, in their account, or through you on their customer page.',
    audienceOrderUpdate:
      'Every cash on delivery buyer gets the first WhatsApp message: it is an update about their own order, not marketing, so it needs no marketing consent. Any step after it is marketing and reaches only customers who said yes.',
    stops: 'The sequence stops as soon as the shopper places an order.',
    minutes: 'minutes',
    days: 'days',
  },
  steps: {
    title: 'Steps',
    add: 'Add step',
    empty: 'Add a wait, a condition or a message.',
    types: {
      wait: 'Wait',
      email: 'Send email',
      whatsapp: 'Send WhatsApp',
      condition: 'Check a condition',
    } satisfies Record<AutomationStepType, string>,
    hints: {
      wait: 'Pause before the next step',
      email: 'An email built from blocks',
      whatsapp: 'An approved WhatsApp template',
      condition: 'Continue only if it holds',
    } satisfies Record<AutomationStepType, string>,
    after: (label: string) => `After ${label}`,
    immediately: 'Right away',
    waitFor: 'Wait for',
    hours: 'hours',
    subject: 'Subject',
    previewText: 'Preview text',
    showPreview: 'Preview',
    hidePreview: 'Hide preview',
    field: 'If',
    op: 'is',
    value: 'Value',
    ops: { gte: 'at least', lte: 'at most', eq: 'exactly' },
    fields: {
      cart_value: 'Basket value (₹)',
      order_count: 'Number of orders',
      has_ordered: 'Has ordered before',
      accepts_marketing: 'Subscribed to marketing',
    } satisfies Record<ConditionField, string>,
    yes: 'Yes',
    no: 'No',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove step',
    noDiscount: 'Choose a discount code for this email before switching the automation on.',
  },
  runs: {
    title: 'Recent shoppers',
    empty: 'No one has entered this automation yet.',
    step: (n: number, total: number) => `Step ${Math.min(n + 1, total)} of ${total}`,
    status: {
      active: 'In progress',
      completed: 'Completed',
      converted: 'Converted',
      stopped: 'Stopped',
    } satisfies Record<MarketingRunStatus, string>,
    reasons: {
      condition: 'condition not met',
      unsubscribed: 'unsubscribed',
    } as Record<string, string>,
  },
} as const

/** "1 hour", "6 hours", "2 days" for waits and timelines. */
export function durationLabel(minutes: number): string {
  if (minutes % 1440 === 0) return minutes === 1440 ? '1 day' : `${minutes / 1440} days`
  if (minutes % 60 === 0) return minutes === 60 ? '1 hour' : `${minutes / 60} hours`
  return `${minutes} minutes`
}
