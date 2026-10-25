/** SOURCE OF TRUTH: automation condition fields — WHAT: every field path a v1 condition can compare (subject, type, list-ness, enum options) / WHY: the condition builder's field picker and the subject loaders in `conditions/**` must agree on the paths. Pure, client-safe; re-exported by `catalogue.ts`. Design §8.2. */
import type { ConditionFieldDescriptor, FieldType } from './catalogue'
import type { BuiltinSubjectType } from './types'

// ---------------------------------------------------------------------------------------------
// Condition fields (v1, design §8.2). The loaders that fill these live in `conditions/**`.
// ---------------------------------------------------------------------------------------------

const f = (
  subject: BuiltinSubjectType,
  path: string,
  type: FieldType,
  extra: Partial<ConditionFieldDescriptor> = {},
): ConditionFieldDescriptor => ({
  path,
  subject,
  type,
  labelKey: `automations.condition.${path}`,
  ...extra,
})

const customerFields = (root: string, subject: BuiltinSubjectType) => [
  f(subject, `${root}.tags`, 'tags'),
  f(subject, `${root}.order_count`, 'number'),
  f(subject, `${root}.total_spent`, 'money'),
  f(subject, `${root}.has_ordered`, 'boolean'),
  f(subject, `${root}.email_consent`, 'boolean'),
  f(subject, `${root}.whatsapp_consent`, 'boolean'),
  f(subject, `${root}.accepts_marketing`, 'boolean'),
  f(subject, `${root}.state`, 'text'),
  f(subject, `${root}.created_at`, 'date'),
]

export const CONDITION_FIELDS: readonly ConditionFieldDescriptor[] = [
  f('order', 'order.number', 'text'),
  f('order', 'order.total', 'money'),
  f('order', 'order.subtotal', 'money'),
  f('order', 'order.discount_total', 'money'),
  f('order', 'order.discount_codes', 'tags'),
  f('order', 'order.payment_method', 'text'),
  f('order', 'order.is_cod', 'boolean'),
  f('order', 'order.financial_status', 'enum', {
    options: ['pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'voided'],
  }),
  f('order', 'order.fulfillment_status', 'enum', {
    options: ['unfulfilled', 'partially_fulfilled', 'fulfilled', 'on_hold'],
  }),
  f('order', 'order.shipping_state', 'text'),
  f('order', 'order.shipping_city', 'text'),
  f('order', 'order.shipping_pincode', 'text'),
  f('order', 'order.tags', 'tags'),
  f('order', 'order.channel', 'text'),
  f('order', 'order.item_count', 'number'),
  f('order', 'order.created_at', 'date'),
  f('order', 'order.line_items.product_title', 'text', { list: true }),
  f('order', 'order.line_items.sku', 'text', { list: true }),
  f('order', 'order.line_items.quantity', 'number', { list: true }),
  f('order', 'order.line_items.price', 'money', { list: true }),
  f('order', 'order.line_items.product_tags', 'tags', { list: true }),
  f('order', 'order.line_items.product_type', 'text', { list: true }),
  ...customerFields('order.customer', 'order'),
  ...customerFields('customer', 'customer'),
  f('product', 'product.status', 'enum', { options: ['active', 'draft', 'archived'] }),
  f('product', 'product.tags', 'tags'),
  f('product', 'product.type', 'text'),
  f('product', 'product.vendor', 'text'),
  f('product', 'product.price', 'money'),
  f('product', 'product.total_stock', 'number'),
  f('product', 'product.collections', 'tags'),
  f('cart', 'cart.total', 'money'),
  f('cart', 'cart.item_count', 'number'),
  ...customerFields('cart.customer', 'cart'),
]
