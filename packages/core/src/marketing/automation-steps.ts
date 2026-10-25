import { z } from 'zod'
import { type EmailBlock, EmailBlocksSchema } from './email'
import { WhatsappTemplateRefSchema } from './whatsapp'

/**
 * Automations: a trigger, then an ordered list of steps. Pure definitions,
 * shared by the admin editor, the API and the worker's runner.
 */

export const AUTOMATION_TRIGGERS = [
  'checkout_abandoned',
  'cart_abandoned',
  'customer_subscribed',
  'first_order',
  'customer_lapsed',
  'cod_order_placed',
] as const
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number]

export const CONDITION_FIELDS = [
  'cart_value',
  'has_ordered',
  'order_count',
  'accepts_marketing',
] as const
export type ConditionField = (typeof CONDITION_FIELDS)[number]

const StepId = z.string().trim().min(1).max(40)

export const AutomationStepSchema = z.discriminatedUnion('type', [
  z.object({
    id: StepId,
    type: z.literal('wait'),
    /** Whole minutes, up to 60 days. */
    minutes: z
      .number()
      .int()
      .min(1)
      .max(60 * 24 * 60),
  }),
  z.object({
    id: StepId,
    type: z.literal('email'),
    subject: z.string().max(200).default(''),
    previewText: z.string().max(200).default(''),
    blocks: EmailBlocksSchema.default([]),
  }),
  z.object({
    id: StepId,
    type: z.literal('whatsapp'),
    template: WhatsappTemplateRefSchema,
  }),
  z.object({
    id: StepId,
    type: z.literal('condition'),
    field: z.enum(CONDITION_FIELDS),
    op: z.enum(['gte', 'lte', 'eq']),
    /** Rupees for cart_value, a count for order_count, 'true'/'false' for the flags. */
    value: z.string().trim().max(40),
  }),
])
export type AutomationStep = z.infer<typeof AutomationStepSchema>
export type AutomationStepType = AutomationStep['type']
export const AutomationStepsSchema = z.array(AutomationStepSchema).max(20)

export const AutomationSettingsSchema = z.object({
  /** For abandoned carts and checkouts: how long a basket sits before it counts. */
  afterMinutes: z
    .number()
    .int()
    .min(15)
    .max(7 * 24 * 60)
    .optional(),
  /** For win-back: days since the last order. */
  lapsedDays: z.number().int().min(7).max(730).optional(),
  /**
   * Kept for automations saved before customer privacy: `all` used to reach
   * shoppers who only left a contact at checkout. It no longer widens
   * anything: marketing steps go only to customers with consent on that
   * channel (enforced in `marketing/send.ts`), and the COD confirmation is an
   * order update that needs none.
   */
  audience: z.enum(['subscribed', 'all']).optional(),
})
export type AutomationSettings = z.infer<typeof AutomationSettingsSchema>

/** Triggers whose runs end as soon as the customer places an order. */
export const STOPS_ON_ORDER: Record<AutomationTrigger, boolean> = {
  checkout_abandoned: true,
  cart_abandoned: true,
  customer_subscribed: true,
  first_order: false,
  customer_lapsed: true,
  cod_order_placed: false,
}

/** Which merge tags and blocks make sense per trigger (the editor greys out the rest). */
export const TRIGGER_HAS_CART: Record<AutomationTrigger, boolean> = {
  checkout_abandoned: true,
  cart_abandoned: true,
  customer_subscribed: false,
  first_order: false,
  customer_lapsed: false,
  cod_order_placed: false,
}

export type AutomationTemplateId =
  | 'abandoned_checkout'
  | 'abandoned_cart'
  | 'welcome_subscriber'
  | 'first_purchase'
  | 'win_back'
  | 'cod_confirmation'

export type AutomationTemplate = {
  id: AutomationTemplateId
  trigger: AutomationTrigger
  name: string
  description: string
  settings: AutomationSettings
  steps: AutomationStep[]
}

const text = (id: string, t: string, heading?: string): EmailBlock => ({
  id,
  type: 'text',
  text: t,
  align: 'left',
  ...(heading ? { heading } : {}),
})
const header = (id: string): EmailBlock => ({ id, type: 'header' })
const button = (id: string, label: string, url: string): EmailBlock => ({
  id,
  type: 'button',
  label,
  url,
})

/** Starting points, Shopify-style: every template is editable once created. */
export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'abandoned_checkout',
    trigger: 'checkout_abandoned',
    name: 'Abandoned checkout recovery',
    description:
      'Reach shoppers who left at checkout and agreed to hear from you: an email after an hour, a WhatsApp nudge at six hours, and a discount on day two.',
    settings: { afterMinutes: 60, audience: 'subscribed' },
    steps: [
      {
        id: 'email-1',
        type: 'email',
        subject: 'You left something in your cart',
        previewText: 'Your basket is saved. Finish your order in a click.',
        blocks: [
          header('b1'),
          text(
            'b2',
            'Hi {first_name}, your basket at {store_name} is waiting for you.',
            'Still thinking it over?',
          ),
          { id: 'b3', type: 'cart' },
          button('b4', 'Return to checkout', '{checkout_url}'),
        ],
      },
      { id: 'wait-1', type: 'wait', minutes: 300 },
      {
        id: 'whatsapp-1',
        type: 'whatsapp',
        template: {
          name: 'checkout_recovery',
          language: 'en',
          variables: ['{first_name}', '{store_name}', '{cart_total}', '{checkout_url}'],
        },
      },
      { id: 'wait-2', type: 'wait', minutes: 1080 },
      {
        id: 'email-2',
        type: 'email',
        subject: 'A little something to help you decide',
        previewText: 'Use your code before it runs out.',
        blocks: [
          header('b1'),
          text(
            'b2',
            'Your basket is still saved. Here is a code for your order, on us.',
            'Come back for less',
          ),
          { id: 'b3', type: 'discount', code: '', heading: 'Your code', note: '' },
          { id: 'b4', type: 'cart' },
          button('b5', 'Complete your order', '{checkout_url}'),
        ],
      },
    ],
  },
  {
    id: 'abandoned_cart',
    trigger: 'cart_abandoned',
    name: 'Abandoned cart',
    description:
      'Signed-in customers who added products but never started checkout get a reminder of what they picked.',
    settings: { afterMinutes: 120, audience: 'subscribed' },
    steps: [
      {
        id: 'email-1',
        type: 'email',
        subject: 'Your picks are waiting',
        previewText: 'Everything you added is still in your cart.',
        blocks: [
          header('b1'),
          text(
            'b2',
            'Hi {first_name}, you left these in your cart at {store_name}.',
            'Forgot something?',
          ),
          { id: 'b3', type: 'cart' },
          button('b4', 'View cart', '{checkout_url}'),
        ],
      },
    ],
  },
  {
    id: 'welcome_subscriber',
    trigger: 'customer_subscribed',
    name: 'Welcome new subscribers',
    description: 'Say hello when someone joins your email list, with a first-order code.',
    settings: { audience: 'subscribed' },
    steps: [
      {
        id: 'email-1',
        type: 'email',
        subject: 'Welcome to {store_name}',
        previewText: 'Thanks for subscribing. Here is something for your first order.',
        blocks: [
          header('b1'),
          text(
            'b2',
            'Thanks for joining us. You will be the first to hear about launches, restocks and offers.',
            'Welcome aboard',
          ),
          { id: 'b3', type: 'discount', code: '', heading: 'Your welcome code', note: '' },
          button('b4', 'Start shopping', '{shop_url}'),
        ],
      },
    ],
  },
  {
    id: 'first_purchase',
    trigger: 'first_order',
    name: 'First purchase thank you',
    description:
      'Thank first-time buyers a few days after their order and suggest what to try next.',
    settings: { audience: 'subscribed' },
    steps: [
      { id: 'wait-1', type: 'wait', minutes: 3 * 24 * 60 },
      {
        id: 'email-1',
        type: 'email',
        subject: 'Thank you for your first order, {first_name}',
        previewText: 'A few picks we think you will like.',
        blocks: [
          header('b1'),
          text(
            'b2',
            'Thank you for choosing {store_name}. We hope you love your order {order_number}.',
            'Thank you',
          ),
          { id: 'b3', type: 'products', heading: 'You might also like', items: [] },
          button('b4', 'Shop again', '{shop_url}'),
        ],
      },
    ],
  },
  {
    id: 'win_back',
    trigger: 'customer_lapsed',
    name: 'Win back lapsed customers',
    description: 'Invite customers back when they have not ordered for a while, with an offer.',
    settings: { lapsedDays: 90, audience: 'subscribed' },
    steps: [
      {
        id: 'email-1',
        type: 'email',
        subject: 'We miss you at {store_name}',
        previewText: 'Here is something to welcome you back.',
        blocks: [
          header('b1'),
          text(
            'b2',
            'It has been a while. A lot has changed, come and see what is new.',
            'It has been a while',
          ),
          { id: 'b3', type: 'discount', code: '', heading: 'Welcome back code', note: '' },
          button('b4', 'See what is new', '{shop_url}'),
        ],
      },
    ],
  },
  {
    id: 'cod_confirmation',
    trigger: 'cod_order_placed',
    name: 'COD order confirmation on WhatsApp',
    description:
      'Ask cash-on-delivery buyers to confirm their order on WhatsApp right after checkout, to cut RTO.',
    settings: { audience: 'subscribed' },
    steps: [
      {
        id: 'whatsapp-1',
        type: 'whatsapp',
        template: {
          name: 'cod_confirmation',
          language: 'en',
          variables: ['{first_name}', '{order_number}', '{cart_total}', '{store_name}'],
        },
      },
    ],
  },
]

export function automationTemplate(id: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id)
}

export function parseAutomationSteps(raw: unknown): AutomationStep[] {
  const r = AutomationStepsSchema.safeParse(raw)
  return r.success ? r.data : []
}

export function parseAutomationSettings(raw: unknown): AutomationSettings {
  const r = AutomationSettingsSchema.safeParse(raw)
  return r.success ? r.data : {}
}

/** Evaluates a condition step against the run's facts. Unusable values fail the condition. */
export function conditionHolds(
  step: Extract<AutomationStep, { type: 'condition' }>,
  facts: { cartValuePaise: number | null; orderCount: number; acceptsMarketing: boolean },
): boolean {
  const cmp = (actual: number, expected: number) =>
    step.op === 'gte'
      ? actual >= expected
      : step.op === 'lte'
        ? actual <= expected
        : actual === expected
  switch (step.field) {
    case 'cart_value': {
      const want = Number.parseFloat(step.value)
      if (facts.cartValuePaise === null || !Number.isFinite(want)) return false
      return cmp(facts.cartValuePaise / 100, want)
    }
    case 'order_count': {
      const want = Number.parseInt(step.value, 10)
      return Number.isFinite(want) && cmp(facts.orderCount, want)
    }
    case 'has_ordered':
      return facts.orderCount > 0 === (step.value === 'true')
    case 'accepts_marketing':
      return facts.acceptsMarketing === (step.value === 'true')
  }
}

/**
 * Whether a step is an order update rather than marketing, so it needs no
 * consent: only the COD confirmation, which is the first step of a
 * `cod_order_placed` automation, a WhatsApp message with no wait before it.
 * Anything a merchant adds after it (a wait, then a promo) is marketing and
 * goes through the consent gate like every other step.
 */
export function isTransactionalStep(
  trigger: AutomationTrigger,
  steps: AutomationStep[],
  index: number,
): boolean {
  return trigger === 'cod_order_placed' && index === 0 && steps[0]?.type === 'whatsapp'
}

/** Total delay before a given step, for the editor's timeline ("Sends after 6 hours"). */
export function minutesBefore(steps: AutomationStep[], index: number): number {
  let total = 0
  for (let i = 0; i < index && i < steps.length; i++) {
    const s = steps[i]
    if (s?.type === 'wait') total += s.minutes
  }
  return total
}
