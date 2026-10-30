/** SOURCE OF TRUTH: payment method rules — WHAT: Settings → Payments → Payment rules (#150, Shopify's payment customizations): rules that hide a way to pay (cash on delivery, the shop's UPI / bank transfer, a gateway) when the order total is above or below an amount, the PIN code is in a list, or the cart holds certain products; stored on `PaymentSettings.methodRules`, with the pure check the checkout preview and `placeOrder` both run / WHY: cash on delivery on big orders, far PIN codes or fragile goods is where RTO losses come from, and the server must refuse what the form hid */
import { z } from 'zod'
import { PINCODE_PATTERN } from '../accounts/schemas'

export const METHOD_RULE_LIMITS = {
  rules: 20,
  pincodes: 5000,
  products: 200,
  name: 80,
} as const

export const PaymentMethodRuleSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().max(METHOD_RULE_LIMITS.name).default(''),
  enabled: z.boolean().default(true),
  /** Payment provider ids the rule hides: `cod`, `manual`, `razorpay`… Never empty. */
  methods: z.array(z.string().min(1).max(40)).min(1).max(12),
  /** `any`: one met condition hides the methods; `all`: every condition set must be met. */
  match: z.enum(['any', 'all']).default('any'),
  /** Order value (items after discount, plus shipping) above this hides; null for no check. */
  totalAbovePaise: z.number().int().min(0).nullable().default(null),
  /** Order value below this hides; null for no check. */
  totalBelowPaise: z.number().int().min(0).nullable().default(null),
  /** The delivery PIN code is one of these. */
  pincodes: z
    .array(z.string().regex(PINCODE_PATTERN))
    .max(METHOD_RULE_LIMITS.pincodes)
    .default([])
    .transform((list) => [...new Set(list)].sort()),
  /** The cart holds any of these products. */
  productIds: z.array(z.string().uuid()).max(METHOD_RULE_LIMITS.products).default([]),
})
export type PaymentMethodRule = z.infer<typeof PaymentMethodRuleSchema>
export type PaymentMethodRuleInput = z.input<typeof PaymentMethodRuleSchema>

export const PaymentMethodRulesSchema = z
  .array(PaymentMethodRuleSchema)
  .max(METHOD_RULE_LIMITS.rules)

export type MethodRuleOrder = {
  /** Items that are not gift cards, after the discount, plus shipping. */
  orderValuePaise: number
  /** The delivery PIN code, six digits (blank before the shopper types one). */
  pincode: string
  productIds: readonly string[]
}

/** The conditions a rule sets, each answered for this order. A rule with none never fires. */
function conditionResults(rule: PaymentMethodRule, order: MethodRuleOrder): boolean[] {
  const out: boolean[] = []
  if (rule.totalAbovePaise !== null) out.push(order.orderValuePaise > rule.totalAbovePaise)
  if (rule.totalBelowPaise !== null) out.push(order.orderValuePaise < rule.totalBelowPaise)
  if (rule.pincodes.length > 0)
    out.push(rule.pincodes.includes(order.pincode.replace(/[\s-]/g, '')))
  if (rule.productIds.length > 0)
    out.push(order.productIds.some((id) => rule.productIds.includes(id)))
  return out
}

/** Whether a rule fires for this order. */
export function ruleMatches(rule: PaymentMethodRule, order: MethodRuleOrder): boolean {
  if (!rule.enabled) return false
  const results = conditionResults(rule, order)
  if (results.length === 0) return false
  return rule.match === 'all' ? results.every(Boolean) : results.some(Boolean)
}

/** Every payment provider id the store's rules hide for this order. */
export function hiddenPaymentMethods(
  rules: readonly PaymentMethodRule[] | undefined,
  order: MethodRuleOrder,
): Set<string> {
  const hidden = new Set<string>()
  for (const rule of rules ?? []) {
    if (ruleMatches(rule, order)) for (const m of rule.methods) hidden.add(m)
  }
  return hidden
}
