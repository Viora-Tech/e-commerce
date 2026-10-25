/** SOURCE OF TRUTH: built-in automation templates — WHAT: the prefilled workflows of the Templates gallery (id, copy keys, category, definition) / WHY: installing a template copies its definition into an Off workflow; the gallery, the API and the template tests read this one list. Growth's six marketing templates join through `growthTemplates` (the Growth migration maps `AUTOMATION_TEMPLATES`). Pure, client-safe. Design §8.8. */
import type { WorkflowDefinition } from './definition'

export const TEMPLATE_CATEGORIES = [
  'orders',
  'customers',
  'inventory',
  'marketing',
  'operations',
] as const
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

export type WorkflowTemplate = {
  id: string
  /** Copy keys in `data/automations.ts` (`automations.template.<id>.name` / `.description`). */
  nameKey: string
  descriptionKey: string
  category: TemplateCategory
  definition: WorkflowDefinition
  /** Apps that must be installed for it to work (plugin pieces). */
  requires?: string[] | undefined
}

const def = (
  trigger: string,
  nodes: WorkflowDefinition['nodes'],
  start: string | null,
  config: Record<string, unknown> = {},
): WorkflowDefinition => ({
  schemaVersion: 1,
  trigger: { type: trigger, config },
  start,
  nodes,
  settings: {},
})

const t = (
  id: string,
  category: TemplateCategory,
  definition: WorkflowDefinition,
): WorkflowTemplate => ({
  id,
  nameKey: `automations.template.${id}.name`,
  descriptionKey: `automations.template.${id}.description`,
  category,
  definition,
})

const staffEmail = (id: string, subject: string, body: string, next: string | null = null) => ({
  kind: 'action' as const,
  id,
  action: 'staff.email',
  config: { to: [], subject, body },
  next,
  onError: 'continue' as const,
})

/** Money in paise. */
const RUPEES = (n: number) => n * 100

export const BUILTIN_TEMPLATES: readonly WorkflowTemplate[] = [
  t(
    'tag-high-value-orders',
    'orders',
    def(
      'order.paid',
      {
        check: {
          kind: 'condition',
          id: 'check',
          rules: { join: 'and', rules: [{ field: 'order.total', op: 'gte', value: RUPEES(5000) }] },
          next: 'tag',
          otherwise: null,
        },
        tag: {
          kind: 'action',
          id: 'tag',
          action: 'order.add_tags',
          config: { tags: ['High value'] },
          next: 'alert',
          onError: 'stop',
        },
        alert: staffEmail(
          'alert',
          'High-value order {order.number}',
          'Order {order.number} is worth {order.total}.',
        ),
      },
      'check',
    ),
  ),
  t(
    'hold-risky-cod',
    'orders',
    def(
      'order.placed',
      {
        check: {
          kind: 'condition',
          id: 'check',
          rules: {
            join: 'and',
            rules: [
              { field: 'order.is_cod', op: 'is_true' },
              { field: 'order.total', op: 'gte', value: RUPEES(3000) },
            ],
          },
          next: 'hold',
          otherwise: null,
        },
        hold: {
          kind: 'action',
          id: 'hold',
          action: 'order.hold',
          config: { reason: 'Check this COD order before packing' },
          next: 'note',
          onError: 'stop',
        },
        note: {
          kind: 'action',
          id: 'note',
          action: 'order.add_note',
          config: { note: 'Held by automation: large COD order. Call the shopper to confirm.' },
          next: 'alert',
          onError: 'continue',
        },
        alert: staffEmail(
          'alert',
          'COD order {order.number} on hold',
          'Confirm order {order.number} with the shopper, then release it.',
        ),
      },
      'check',
    ),
  ),
  t(
    'tag-repeat-customers',
    'customers',
    def(
      'order.paid',
      {
        check: {
          kind: 'condition',
          id: 'check',
          rules: {
            join: 'and',
            rules: [{ field: 'order.customer.order_count', op: 'gte', value: 3 }],
          },
          next: 'tag',
          otherwise: null,
        },
        tag: {
          kind: 'action',
          id: 'tag',
          action: 'customer.add_tags',
          config: { tags: ['Repeat customer'] },
          next: null,
          onError: 'stop',
        },
      },
      'check',
    ),
  ),
  t(
    'low-stock-alert',
    'inventory',
    def(
      'inventory.low',
      {
        alert: staffEmail(
          'alert',
          'Running low: {product.title}',
          '{product.title} has {product.total_stock} left.',
        ),
      },
      'alert',
    ),
  ),
  t(
    'new-arrivals-collection',
    'inventory',
    def(
      'product.created',
      {
        add: {
          kind: 'action',
          id: 'add',
          action: 'collection.add_product',
          config: {},
          next: null,
          onError: 'stop',
        },
      },
      'add',
    ),
  ),
  t(
    'alert-return-requested',
    'operations',
    def(
      'return.requested',
      {
        alert: staffEmail(
          'alert',
          'Return requested on {order.number}',
          'A shopper asked to return items from order {order.number}.',
        ),
      },
      'alert',
    ),
  ),
  t(
    'notify-packer-whatsapp',
    'operations',
    def(
      'order.paid',
      {
        notify: {
          kind: 'action',
          id: 'notify',
          action: 'staff.whatsapp',
          config: { to: [] },
          next: null,
          onError: 'continue',
        },
      },
      'notify',
    ),
  ),
  t(
    'remind-unpaid-orders',
    'orders',
    def(
      'schedule',
      {
        find: {
          kind: 'find',
          id: 'find',
          resource: 'order',
          rules: {
            join: 'and',
            rules: [
              { field: 'order.financial_status', op: 'is_one_of', value: ['pending'] },
              { field: 'order.is_cod', op: 'is_false' },
              { field: 'order.created_at', op: 'older_than_days', value: 3 },
            ],
          },
          limit: 100,
          next: 'each',
        },
        each: { kind: 'forEach', id: 'each', source: 'find', body: 'remind', next: null },
        remind: {
          kind: 'action',
          id: 'remind',
          action: 'customer.send_order_update',
          config: { channel: 'email', template: 'payment_reminder' },
          next: null,
          onError: 'continue',
        },
      },
      'find',
      { every: 'day', at: '10:00' },
    ),
  ),
  t(
    'cancel-unconfirmed-cod',
    'orders',
    def(
      'order.cod_placed',
      {
        wait: { kind: 'wait', id: 'wait', minutes: 48 * 60, next: 'check' },
        check: {
          kind: 'condition',
          id: 'check',
          rules: {
            join: 'and',
            rules: [{ field: 'order.tags', op: 'not_includes', value: ['Confirmed'] }],
          },
          next: 'cancel',
          otherwise: null,
        },
        cancel: {
          kind: 'action',
          id: 'cancel',
          action: 'order.cancel',
          config: { reason: 'declined', notifyCustomer: true, restock: true },
          next: null,
          onError: 'stop',
          needsApproval: true,
        },
      },
      'wait',
    ),
  ),
]

export const builtinTemplate = (id: string): WorkflowTemplate | null =>
  BUILTIN_TEMPLATES.find((tpl) => tpl.id === id) ?? null
