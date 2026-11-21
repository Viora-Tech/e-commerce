import { sampleTemplateDataFor } from '../samples-dated'
import type { TemplateData, TemplateId } from '../types'
import { VAR } from './variable-syntax'

export { fillForCheck, unknownVariables } from './variable-syntax'

/**
 * Words a merchant can drop into a design's text, buttons and subject as `{{name}}`. Each reads
 * one field of `TemplateData`; a template offers the ones its data carries. Codes (sign-in,
 * gift card) are not variables: they only ever show in their own locked block.
 */
const VARIABLES = {
  customer_name: (d) => d.customerName,
  store_name: (d) => d.storeName,
  shop_url: (d) => d.brand?.shopUrl ?? undefined,
  support_email: (d) => d.brand?.supportEmail ?? undefined,
  support_phone: (d) => d.brand?.supportPhone ?? undefined,
  order_number: (d) =>
    d.orderNumber !== undefined
      ? String(d.orderNumber)
      : d.draftNumber !== undefined
        ? `D${d.draftNumber}`
        : undefined,
  order_total: (d) => (d.lines.length > 0 ? d.totalLabel : undefined),
  payment_method: (d) => (d.lines.length > 0 ? d.paymentMethodLabel || undefined : undefined),
  order_url: (d) => d.orderUrl,
  order_date: (d) => d.placedLabel,
  tracking_url: (d) => d.trackingUrl,
  tracking_number: (d) => d.waybill,
  courier: (d) => d.courierLabel,
  delivered_on: (d) => d.deliveredLabel,
  return_number: (d) => d.returnInfo?.label,
  coupon_value: (d) => d.welcome?.valueLabel,
} satisfies Record<string, (d: TemplateData) => string | undefined>

export type DesignVariable = keyof typeof VARIABLES

export const DESIGN_VARIABLES = Object.keys(VARIABLES) as DesignVariable[]

/** Always offered: they come from the store, not the message. */
const ALWAYS: ReadonlySet<DesignVariable> = new Set<DesignVariable>([
  'customer_name',
  'store_name',
  'shop_url',
  'support_email',
  'support_phone',
])

/** The variables a template's emails can fill (from its sample data). */
export function variablesFor(template: TemplateId): DesignVariable[] {
  const d = sampleTemplateDataFor(template)
  return DESIGN_VARIABLES.filter((v) => ALWAYS.has(v) || VARIABLES[v](d) !== undefined)
}

/**
 * The text with its variables filled from this message's data. An unknown variable or one with
 * no value in this message becomes empty, so a shopper never sees `{{...}}`. The result is plain
 * text: React escapes it when the email is drawn.
 */
export function fillVariables(text: string, d: TemplateData): string {
  return text.replace(VAR, (_whole, name: string) => {
    const read = (VARIABLES as Record<string, (d: TemplateData) => string | undefined>)[name]
    return read ? (read(d) ?? '') : ''
  })
}
