/** SOURCE OF TRUTH: InboxWidgetSchema, INBOX_WIDGET_FIELDS, inboxFromApps — WHAT: the storefront chat widget's look (Shopify Inbox's app embed: on/off, featured products, colours, activator icon/label/position, typography, border radius) as a schema plus a field list the theme editor's App embeds panel renders, and reading Inbox's install + settings from a `store.apps` value without a query / WHY: the coordinator's theme-editor panel draws these fields generically and saves them through `inbox.settings.save({ widget })`; the storefront layout already holds `store.apps` (design §12). Pure. */
import { z } from 'zod'
import { appSettingsOf, parseAppsSettings } from '../apps/settings'
import { INBOX_APP_ID } from './constants'

const Colour = z
  .string()
  .trim()
  .regex(/^(#[0-9a-fA-F]{6})?$/, 'A colour like #1a1a1a, or blank for the theme’s')

export const WIDGET_ICONS = ['chat', 'bubble', 'help', 'none'] as const
export const WIDGET_HORIZONTAL = ['left', 'center', 'right'] as const
export const WIDGET_VERTICAL = ['lowest', 'higher', 'highest'] as const

export const InboxWidgetSchema = z.object({
  /** Off hides the chat button everywhere on the storefront. */
  enabled: z.boolean().default(true),
  showFeaturedProducts: z.boolean().default(true),
  /** Up to two products beside the intro; empty shows the two best sellers. */
  featuredProductIds: z.array(z.uuid()).max(2).default([]),
  /** Blank uses the theme's colours. */
  background: Colour.default(''),
  textColour: Colour.default(''),
  /** Swap the activator's fill and text colours. */
  invertActivator: z.boolean().default(false),
  activatorIcon: z.enum(WIDGET_ICONS).default('chat'),
  /** Blank shows "Chat" in the shopper's language. */
  activatorLabel: z.string().trim().max(24).default(''),
  horizontal: z.enum(WIDGET_HORIZONTAL).default('right'),
  vertical: z.enum(WIDGET_VERTICAL).default('lowest'),
  /** Use the theme's body font; off uses the system font. */
  inheritFont: z.boolean().default(true),
  /** In px, as the theme editor shows it. */
  activatorFontSize: z.number().int().min(12).max(20).default(15),
  /** In px. */
  borderRadius: z.number().int().min(0).max(32).default(24),
})
export type InboxWidget = z.infer<typeof InboxWidgetSchema>
export const DEFAULT_INBOX_WIDGET: InboxWidget = InboxWidgetSchema.parse({})

/** One field the theme editor's App embeds panel draws for the Inbox embed. */
export type InboxWidgetField =
  | { key: keyof InboxWidget; type: 'switch'; label: string; group: string; help?: string }
  | {
      key: keyof InboxWidget
      type: 'text'
      label: string
      group: string
      max: number
      placeholder?: string
    }
  | { key: keyof InboxWidget; type: 'colour'; label: string; group: string; help?: string }
  | {
      key: keyof InboxWidget
      type: 'products'
      label: string
      group: string
      max: number
      help?: string
    }
  | {
      key: keyof InboxWidget
      type: 'select'
      label: string
      group: string
      options: { value: string; label: string }[]
    }
  | {
      key: keyof InboxWidget
      type: 'range'
      label: string
      group: string
      min: number
      max: number
      unit: 'px'
    }

/**
 * The Inbox app embed's fields, in the order the theme editor shows them (Shopify Inbox's
 * embed: Featured products, Colours, Activator, Typography, Borders). English labels; the
 * editor translates by key when it has copy for them.
 */
export const INBOX_WIDGET_FIELDS: InboxWidgetField[] = [
  { key: 'enabled', type: 'switch', label: 'Show the chat on your store', group: 'Inbox' },
  {
    key: 'showFeaturedProducts',
    type: 'switch',
    label: 'Show featured products',
    group: 'Featured products',
  },
  {
    key: 'featuredProductIds',
    type: 'products',
    label: 'Products',
    group: 'Featured products',
    max: 2,
    help: 'Leave empty to show your two best sellers.',
  },
  {
    key: 'background',
    type: 'colour',
    label: 'Background',
    group: 'Colours',
    help: 'Blank uses your theme',
  },
  {
    key: 'textColour',
    type: 'colour',
    label: 'Font colour',
    group: 'Colours',
    help: 'Blank uses your theme',
  },
  { key: 'invertActivator', type: 'switch', label: 'Invert activator colours', group: 'Colours' },
  {
    key: 'activatorIcon',
    type: 'select',
    label: 'Icon',
    group: 'Activator',
    options: [
      { value: 'chat', label: 'Chat bubble' },
      { value: 'bubble', label: 'Speech bubbles' },
      { value: 'help', label: 'Question mark' },
      { value: 'none', label: 'No icon' },
    ],
  },
  {
    key: 'activatorLabel',
    type: 'text',
    label: 'Label',
    group: 'Activator',
    max: 24,
    placeholder: 'Chat',
  },
  {
    key: 'horizontal',
    type: 'select',
    label: 'Horizontal position',
    group: 'Activator',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ],
  },
  {
    key: 'vertical',
    type: 'select',
    label: 'Vertical position',
    group: 'Activator',
    options: [
      { value: 'lowest', label: 'Lowest' },
      { value: 'higher', label: 'Higher' },
      { value: 'highest', label: 'Highest' },
    ],
  },
  { key: 'inheritFont', type: 'switch', label: 'Inherit font from theme', group: 'Typography' },
  {
    key: 'activatorFontSize',
    type: 'range',
    label: 'Activator font size',
    group: 'Typography',
    min: 12,
    max: 20,
    unit: 'px',
  },
  {
    key: 'borderRadius',
    type: 'range',
    label: 'Border radius',
    group: 'Borders',
    min: 0,
    max: 32,
    unit: 'px',
  },
]

/** Whatever is stored as widget settings; a broken field falls back on its own. */
export function parseInboxWidget(raw: unknown): InboxWidget {
  const whole = InboxWidgetSchema.safeParse(raw ?? {})
  if (whole.success) return whole.data
  const out: Record<string, unknown> = { ...DEFAULT_INBOX_WIDGET }
  if (raw && typeof raw === 'object') {
    const shape = InboxWidgetSchema.shape
    for (const [key, value] of Object.entries(raw)) {
      const field = shape[key as keyof typeof shape]
      const parsed = field?.safeParse(value)
      if (parsed?.success) out[key] = parsed.data
    }
  }
  return out as InboxWidget
}

/** Inbox's install and raw settings from a `store.apps` value the caller already holds. */
export function inboxFromApps(apps: unknown): { installed: boolean; raw: unknown } {
  const parsed = parseAppsSettings(apps)
  return {
    installed: parsed.installed.includes(INBOX_APP_ID),
    raw: appSettingsOf(parsed, INBOX_APP_ID),
  }
}
