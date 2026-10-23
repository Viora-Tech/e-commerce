/** SOURCE OF TRUTH: built-in automation actions — WHAT: every v1 action (id, copy key, subjects, resource, permission, risk, approval defaults, plan tier, config schema and form) / WHY: the editor's action picker, the publish check and the interpreter resolve actions from this list; executors in `actions/**` attach by id. Pure, client-safe; re-exported by `catalogue.ts`. Design §8.4; owner answers Q2 (cancel asks first) and Q4 (two customer-message actions). */
import { z } from 'zod'
import { EmailBlocksSchema } from '../marketing/email'
import { WhatsappTemplateRefSchema } from '../marketing/whatsapp'
import { permissions } from '../permissions/statement'
import type { ActionDescriptor, FieldSpec } from './catalogue'

const Empty = z.object({}).strict()
const Tag = z.string().trim().min(1).max(40)
const TagsConfig = z.object({ tags: z.array(Tag).min(1).max(20) })
const MergeText = (max: number) => z.string().trim().min(1).max(max)
const Metafield = z.object({
  namespace: z.string().trim().min(1).max(60),
  key: z.string().trim().min(1).max(60),
  /** Text with merge tags, written as the definition's type. */
  value: z.string().max(5000),
})
const CollectionConfig = z.object({ collectionId: z.uuid() })
const tags = (labelKey = 'automations.field.tags'): FieldSpec => ({
  key: 'tags',
  type: 'tags',
  labelKey,
  required: true,
  max: 20,
})

// ---------------------------------------------------------------------------------------------
// Built-in actions (v1, design §8.4; owner answers Q2 and Q4)
// ---------------------------------------------------------------------------------------------

export const BUILTIN_ACTION_IDS = [
  'order.add_tags',
  'order.remove_tags',
  'customer.add_tags',
  'customer.remove_tags',
  'product.add_tags',
  'product.remove_tags',
  'order.add_note',
  'order.set_metafield',
  'customer.set_metafield',
  'product.set_metafield',
  'collection.add_product',
  'collection.remove_product',
  'order.hold',
  'order.release',
  'order.fulfil',
  'order.cancel',
  'staff.email',
  'staff.whatsapp',
  'marketing.send_email',
  'marketing.send_whatsapp',
  'customer.send_order_update',
  'http.request',
] as const
export type BuiltinActionId = (typeof BUILTIN_ACTION_IDS)[number]

type ActionInput = Omit<
  ActionDescriptor,
  'labelKey' | 'dangerous' | 'external' | 'defaultNeedsApproval' | 'approvalOwnerOnly' | 'planTier'
> &
  Partial<
    Pick<
      ActionDescriptor,
      'external' | 'defaultNeedsApproval' | 'approvalOwnerOnly' | 'planTier' | 'labelKey'
    >
  >

const action = (a: ActionInput): ActionDescriptor => ({
  labelKey: `automations.action.${a.id}`,
  external: false,
  defaultNeedsApproval: false,
  approvalOwnerOnly: false,
  planTier: 'starter',
  ...a,
  dangerous: a.risk === 'sensitive',
})

export const BUILTIN_ACTIONS: readonly ActionDescriptor[] = [
  action({
    id: 'order.add_tags',
    subjects: ['order'],
    resource: 'orders',
    permission: permissions.ORDERS_WRITE,
    risk: 'safe',
    configSchema: TagsConfig,
    configFields: [tags()],
  }),
  action({
    id: 'order.remove_tags',
    subjects: ['order'],
    resource: 'orders',
    permission: permissions.ORDERS_WRITE,
    risk: 'safe',
    configSchema: TagsConfig,
    configFields: [tags()],
  }),
  action({
    // On an order subject: the order's customer.
    id: 'customer.add_tags',
    subjects: ['customer', 'order', 'cart'],
    resource: 'customers',
    permission: permissions.CUSTOMERS_WRITE,
    risk: 'safe',
    configSchema: TagsConfig,
    configFields: [tags()],
  }),
  action({
    id: 'customer.remove_tags',
    subjects: ['customer', 'order', 'cart'],
    resource: 'customers',
    permission: permissions.CUSTOMERS_WRITE,
    risk: 'safe',
    configSchema: TagsConfig,
    configFields: [tags()],
  }),
  action({
    id: 'product.add_tags',
    subjects: ['product'],
    resource: 'products',
    permission: permissions.PRODUCTS_WRITE,
    risk: 'safe',
    configSchema: TagsConfig,
    configFields: [tags()],
  }),
  action({
    id: 'product.remove_tags',
    subjects: ['product'],
    resource: 'products',
    permission: permissions.PRODUCTS_WRITE,
    risk: 'safe',
    configSchema: TagsConfig,
    configFields: [tags()],
  }),
  action({
    id: 'order.add_note',
    subjects: ['order'],
    resource: 'orders',
    permission: permissions.ORDERS_WRITE,
    risk: 'safe',
    configSchema: z.object({ note: MergeText(2000) }),
    configFields: [
      {
        key: 'note',
        type: 'template',
        multiline: true,
        labelKey: 'automations.field.note',
        required: true,
      },
    ],
  }),
  ...(['order', 'customer', 'product'] as const).map((subject) =>
    action({
      id: `${subject}.set_metafield`,
      subjects: subject === 'customer' ? ['customer', 'order'] : [subject],
      resource: 'metafields',
      permission:
        subject === 'order'
          ? permissions.ORDERS_WRITE
          : subject === 'customer'
            ? permissions.CUSTOMERS_WRITE
            : permissions.PRODUCTS_WRITE,
      risk: 'safe',
      configSchema: Metafield,
      configFields: [
        { key: 'namespace', type: 'text', labelKey: 'automations.field.namespace', required: true },
        { key: 'key', type: 'text', labelKey: 'automations.field.key', required: true },
        { key: 'value', type: 'template', labelKey: 'automations.field.value', required: true },
      ],
    }),
  ),
  action({
    id: 'collection.add_product',
    subjects: ['product'],
    resource: 'collections',
    permission: permissions.PRODUCTS_WRITE,
    risk: 'safe',
    configSchema: CollectionConfig,
    configFields: [
      {
        key: 'collectionId',
        type: 'record',
        recordType: 'collection',
        labelKey: 'automations.field.collection',
        required: true,
      },
    ],
  }),
  action({
    id: 'collection.remove_product',
    subjects: ['product'],
    resource: 'collections',
    permission: permissions.PRODUCTS_WRITE,
    risk: 'safe',
    configSchema: CollectionConfig,
    configFields: [
      {
        key: 'collectionId',
        type: 'record',
        recordType: 'collection',
        labelKey: 'automations.field.collection',
        required: true,
      },
    ],
  }),
  action({
    id: 'order.hold',
    subjects: ['order'],
    resource: 'orders',
    permission: permissions.ORDERS_FULFIL,
    risk: 'safe',
    configSchema: z.object({ reason: z.string().trim().max(200).default('') }),
    configFields: [{ key: 'reason', type: 'text', labelKey: 'automations.field.holdReason' }],
  }),
  action({
    id: 'order.release',
    subjects: ['order'],
    resource: 'orders',
    permission: permissions.ORDERS_FULFIL,
    risk: 'safe',
    configSchema: Empty,
    configFields: [],
  }),
  action({
    id: 'order.fulfil',
    subjects: ['order'],
    resource: 'orders',
    permission: permissions.ORDERS_FULFIL,
    risk: 'sensitive',
    configSchema: z.object({ notifyCustomer: z.boolean().default(false) }),
    configFields: [
      { key: 'notifyCustomer', type: 'boolean', labelKey: 'automations.field.notifyCustomer' },
    ],
  }),
  action({
    id: 'order.cancel',
    subjects: ['order'],
    resource: 'orders',
    permission: permissions.ORDERS_CANCEL,
    risk: 'sensitive',
    defaultNeedsApproval: true,
    approvalOwnerOnly: true,
    configSchema: z.object({
      reason: z.enum(['customer', 'fraud', 'inventory', 'declined', 'other']).default('other'),
      notifyCustomer: z.boolean().default(true),
      restock: z.boolean().default(true),
    }),
    configFields: [
      {
        key: 'reason',
        type: 'select',
        labelKey: 'automations.field.cancelReason',
        options: ['customer', 'fraud', 'inventory', 'declined', 'other'].map((value) => ({
          value,
          labelKey: `automations.enum.cancelReason.${value}`,
        })),
      },
      { key: 'notifyCustomer', type: 'boolean', labelKey: 'automations.field.notifyCustomer' },
      { key: 'restock', type: 'boolean', labelKey: 'automations.field.restock' },
    ],
  }),
  action({
    id: 'staff.email',
    subjects: 'any',
    resource: 'staff-messages',
    permission: permissions.SETTINGS_READ,
    risk: 'safe',
    external: true,
    configSchema: z.object({
      to: z.array(z.email()).min(1).max(10),
      subject: MergeText(200),
      body: MergeText(5000),
    }),
    configFields: [
      { key: 'to', type: 'emails', labelKey: 'automations.field.staffEmails', required: true },
      { key: 'subject', type: 'template', labelKey: 'automations.field.subject', required: true },
      {
        key: 'body',
        type: 'template',
        multiline: true,
        labelKey: 'automations.field.body',
        required: true,
      },
    ],
  }),
  action({
    id: 'staff.whatsapp',
    subjects: 'any',
    resource: 'staff-messages',
    permission: permissions.SETTINGS_READ,
    risk: 'safe',
    external: true,
    configSchema: z.object({
      to: z.array(z.string().trim().min(8).max(20)).min(1).max(10),
      template: WhatsappTemplateRefSchema,
    }),
    configFields: [
      { key: 'to', type: 'phones', labelKey: 'automations.field.staffPhones', required: true },
      {
        key: 'template',
        type: 'whatsapp_template',
        purpose: 'staff',
        labelKey: 'automations.field.whatsappTemplate',
        required: true,
      },
    ],
  }),
  action({
    // Consent-gated through marketing/send.ts (Q4, first of two).
    id: 'marketing.send_email',
    subjects: ['customer', 'order', 'cart'],
    resource: 'customer-messages',
    permission: permissions.MARKETING_SEND,
    risk: 'customer',
    external: true,
    marketing: true,
    configSchema: z.object({
      subject: z.string().max(200).default(''),
      previewText: z.string().max(200).default(''),
      blocks: EmailBlocksSchema.default([]),
    }),
    configFields: [{ key: 'blocks', type: 'email_design', labelKey: 'automations.field.email' }],
  }),
  action({
    id: 'marketing.send_whatsapp',
    subjects: ['customer', 'order', 'cart'],
    resource: 'customer-messages',
    permission: permissions.MARKETING_SEND,
    risk: 'customer',
    external: true,
    marketing: true,
    configSchema: z.object({ template: WhatsappTemplateRefSchema }),
    configFields: [
      {
        key: 'template',
        type: 'whatsapp_template',
        purpose: 'marketing',
        labelKey: 'automations.field.whatsappTemplate',
        required: true,
      },
    ],
  }),
  action({
    // No consent needed, so only order email templates or utility WhatsApp templates, only on
    // order subjects, only to the order's own contact (Q4, second of two).
    id: 'customer.send_order_update',
    subjects: ['order'],
    resource: 'customer-messages',
    permission: permissions.ORDERS_WRITE,
    risk: 'customer',
    external: true,
    configSchema: z.discriminatedUnion('channel', [
      z.object({ channel: z.literal('email'), template: z.string().trim().min(1).max(60) }),
      z.object({ channel: z.literal('whatsapp'), template: WhatsappTemplateRefSchema }),
    ]),
    configFields: [
      {
        key: 'channel',
        type: 'select',
        labelKey: 'automations.field.channel',
        options: [
          { value: 'email', labelKey: 'automations.enum.channel.email' },
          { value: 'whatsapp', labelKey: 'automations.enum.channel.whatsapp' },
        ],
        required: true,
      },
      {
        key: 'template',
        type: 'order_email_template',
        labelKey: 'automations.field.orderTemplate',
        required: true,
      },
    ],
  }),
  action({
    id: 'http.request',
    subjects: 'any',
    resource: 'external',
    permission: permissions.SETTINGS_MANAGE,
    risk: 'sensitive',
    external: true,
    planTier: 'growth',
    configSchema: z.object({
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
      url: z.url().max(2000),
      headers: z
        .array(z.object({ name: z.string().trim().min(1).max(100), value: z.string().max(2000) }))
        .max(20)
        .default([]),
      body: z.string().max(20_000).default(''),
      /** What a 4xx/5xx/429 answer does (Flow's per-action choice). */
      onHttpError: z.enum(['retry', 'fail', 'continue']).default('retry'),
    }),
    configFields: [
      {
        key: 'method',
        type: 'select',
        labelKey: 'automations.field.method',
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({
          value,
          label: { en: value },
        })),
      },
      { key: 'url', type: 'template', labelKey: 'automations.field.url', required: true },
      { key: 'headers', type: 'key_value', labelKey: 'automations.field.headers', max: 20 },
      { key: 'body', type: 'template', multiline: true, labelKey: 'automations.field.body' },
      {
        key: 'onHttpError',
        type: 'select',
        labelKey: 'automations.field.onHttpError',
        options: ['retry', 'fail', 'continue'].map((value) => ({
          value,
          labelKey: `automations.enum.onHttpError.${value}`,
        })),
      },
    ],
  }),
]
