/** SOURCE OF TRUTH: built-in automation triggers — WHAT: every v1 trigger (id, copy key, subject, source, outbox types, config schema and form) / WHY: the editor's trigger picker, the publish check and the trigger job resolve triggers from this list. Pure, client-safe; re-exported by `catalogue.ts`. Design §8.4. */
import { z } from 'zod'
import type { FieldSpec, TriggerDescriptor } from './catalogue'

const Empty = z.object({}).strict()
const TestOrders = z.object({
  /** Orders paid on a gateway's test keys start runs only with this on (PR #608). */
  includeTest: z.boolean().default(false),
})
const AfterMinutes = z.object({
  afterMinutes: z
    .number()
    .int()
    .min(15)
    .max(7 * 24 * 60)
    .default(60),
})
const ScheduleConfig = z.object({
  every: z.enum(['hour', 'day', 'week']),
  /** IST, `HH:MM`, for day and week. */
  at: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  /** 0 = Sunday, for week. */
  weekday: z.number().int().min(0).max(6).optional(),
})
const includeTest: FieldSpec = {
  key: 'includeTest',
  type: 'boolean',
  labelKey: 'automations.field.includeTest',
}

// ---------------------------------------------------------------------------------------------
// Built-in triggers (v1, design §8.4)
// ---------------------------------------------------------------------------------------------

export const BUILTIN_TRIGGER_IDS = [
  'order.placed',
  'order.paid',
  'order.fulfilled',
  'order.cancelled',
  'order.delivered',
  'order.cod_placed',
  'refund.created',
  'return.requested',
  'customer.created',
  'customer.tags_changed',
  'customer.subscribed',
  'customer.first_order',
  'customer.lapsed',
  'product.created',
  'product.updated',
  'inventory.low',
  'inventory.out',
  'checkout.abandoned',
  'cart.abandoned',
  'schedule',
  'manual.order',
  'manual.customer',
  'manual.product',
] as const
export type BuiltinTriggerId = (typeof BUILTIN_TRIGGER_IDS)[number]

const orderTrigger = (
  id: BuiltinTriggerId,
  outboxTypes: readonly string[],
  extra: Partial<TriggerDescriptor> = {},
): TriggerDescriptor => ({
  id,
  labelKey: `automations.trigger.${id}`,
  subject: 'order',
  source: 'outbox',
  outboxTypes,
  group: 'orders',
  configSchema: TestOrders,
  configFields: [includeTest],
  planTier: 'starter',
  ...extra,
})

export const BUILTIN_TRIGGERS: readonly TriggerDescriptor[] = [
  orderTrigger('order.placed', ['order.placed']),
  orderTrigger('order.paid', ['order.paid']),
  orderTrigger('order.fulfilled', ['order.fulfilled']),
  orderTrigger('order.cancelled', ['order.cancelled']),
  orderTrigger('order.delivered', ['order.delivered']),
  // order.placed where the payment method is COD (Growth's cod_order_placed).
  orderTrigger('order.cod_placed', ['order.placed'], { marketing: true, group: 'marketing' }),
  orderTrigger('refund.created', ['refund.created']),
  orderTrigger('return.requested', ['return.requested']),
  {
    id: 'customer.created',
    labelKey: 'automations.trigger.customer.created',
    subject: 'customer',
    source: 'outbox',
    outboxTypes: ['customer.created'],
    group: 'customers',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
  {
    id: 'customer.tags_changed',
    labelKey: 'automations.trigger.customer.tags_changed',
    subject: 'customer',
    source: 'outbox',
    outboxTypes: ['customer.tags_changed'],
    group: 'customers',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
  {
    id: 'customer.subscribed',
    labelKey: 'automations.trigger.customer.subscribed',
    subject: 'customer',
    source: 'outbox',
    outboxTypes: ['customer.subscribed'],
    group: 'marketing',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
    marketing: true,
  },
  {
    // Fired from the order.placed trigger job when the customer's non-imported order count is 1.
    id: 'customer.first_order',
    labelKey: 'automations.trigger.customer.first_order',
    subject: 'order',
    source: 'outbox',
    outboxTypes: ['order.placed'],
    group: 'marketing',
    configSchema: TestOrders,
    configFields: [includeTest],
    planTier: 'starter',
    marketing: true,
  },
  {
    id: 'customer.lapsed',
    labelKey: 'automations.trigger.customer.lapsed',
    subject: 'customer',
    source: 'sweep',
    group: 'marketing',
    configSchema: z.object({ lapsedDays: z.number().int().min(7).max(730).default(90) }),
    configFields: [
      { key: 'lapsedDays', type: 'number', labelKey: 'automations.field.lapsedDays', min: 7 },
    ],
    planTier: 'starter',
    marketing: true,
  },
  {
    id: 'product.created',
    labelKey: 'automations.trigger.product.created',
    subject: 'product',
    source: 'outbox',
    outboxTypes: ['product.created'],
    group: 'products',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
  {
    id: 'product.updated',
    labelKey: 'automations.trigger.product.updated',
    subject: 'product',
    source: 'outbox',
    outboxTypes: ['product.updated'],
    group: 'products',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
  {
    id: 'inventory.low',
    labelKey: 'automations.trigger.inventory.low',
    subject: 'product',
    source: 'outbox',
    outboxTypes: ['inventory.low'],
    group: 'inventory',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
  {
    id: 'inventory.out',
    labelKey: 'automations.trigger.inventory.out',
    subject: 'product',
    source: 'outbox',
    outboxTypes: ['inventory.out'],
    group: 'inventory',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
  {
    id: 'checkout.abandoned',
    labelKey: 'automations.trigger.checkout.abandoned',
    subject: 'cart',
    source: 'sweep',
    group: 'marketing',
    configSchema: AfterMinutes,
    configFields: [{ key: 'afterMinutes', type: 'minutes', labelKey: 'automations.field.after' }],
    planTier: 'starter',
    marketing: true,
  },
  {
    id: 'cart.abandoned',
    labelKey: 'automations.trigger.cart.abandoned',
    subject: 'cart',
    source: 'sweep',
    group: 'marketing',
    configSchema: AfterMinutes,
    configFields: [{ key: 'afterMinutes', type: 'minutes', labelKey: 'automations.field.after' }],
    planTier: 'starter',
    marketing: true,
  },
  {
    id: 'schedule',
    labelKey: 'automations.trigger.schedule',
    subject: 'none',
    source: 'schedule',
    group: 'schedule',
    configSchema: ScheduleConfig,
    configFields: [{ key: 'every', type: 'schedule', labelKey: 'automations.field.schedule' }],
    planTier: 'starter',
  },
  {
    id: 'manual.order',
    labelKey: 'automations.trigger.manual.order',
    subject: 'order',
    source: 'manual',
    group: 'manual',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
  {
    id: 'manual.customer',
    labelKey: 'automations.trigger.manual.customer',
    subject: 'customer',
    source: 'manual',
    group: 'manual',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
  {
    id: 'manual.product',
    labelKey: 'automations.trigger.manual.product',
    subject: 'product',
    source: 'manual',
    group: 'manual',
    configSchema: Empty,
    configFields: [],
    planTier: 'starter',
  },
]
