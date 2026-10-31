import type { DrillRow } from '@/components/settings/settings-drill'
import type { paymentRulesContent } from '@/data/payment-rules'
import type { MethodId, methodNames } from '@/data/payments-setup'
import type { CheckoutMethodRow, PaymentsSetup } from './types'

type PageCopy = (typeof paymentRulesContent)['page']
type Names = typeof methodNames

/** The row ids, also the `?open=` values and the old `#anchors` the settings search links to. */
export const PAYMENT_ROWS = {
  providers: 'providers',
  methods: 'methods',
  manual: 'manual',
  capture: 'capture',
  rules: 'rules',
  more: 'more',
} as const

/** The "Payment configuration" section's rows, in order; providers and manual have their own sections. */
export const CONFIG_ROWS = [
  PAYMENT_ROWS.capture,
  PAYMENT_ROWS.rules,
  PAYMENT_ROWS.methods,
  PAYMENT_ROWS.more,
] as const

/**
 * Settings → Payments' drill rows (Shopify-style): payment providers, supported methods, manual
 * methods, capture, customizations and More, each with its current value in a few words. Every
 * id here is a valid `?open=`; the page's sections show the configuration ones as rows.
 */
export function paymentRows(
  setup: PaymentsSetup,
  methods: CheckoutMethodRow[],
  copy: PageCopy,
  names: Names,
): DrillRow[] {
  const connected = setup.gateways.filter((g) => g.connected)
  const main = setup.primary?.label ?? connected[0]?.name ?? null
  const online = methods.filter((m) => m.on && m.id !== 'cod')
  const manual = [
    setup.manualMethods.upi.on ? copy.manualKinds.upi : null,
    setup.manualMethods.bank.on ? copy.manualKinds.bank : null,
    methods.some((m) => m.id === 'cod' && m.on) ? copy.manualKinds.cod : null,
  ].filter((x) => x !== null)
  const manualCapture = setup.gateways
    .filter((g) => setup.capture[g.id]?.mode === 'manual')
    .map((g) => g.name)
  const ruleCount = setup.methodRules.length
  const rows: DrillRow[] = [
    {
      id: PAYMENT_ROWS.providers,
      title: copy.providers,
      value: main ? copy.providersValue(main, Math.max(1, connected.length)) : copy.providersNone,
    },
    {
      id: PAYMENT_ROWS.methods,
      title: copy.methods,
      value: online.length
        ? online.map((m) => names[m.id as MethodId]?.name ?? m.id).join(', ')
        : copy.methodsNone,
    },
    {
      id: PAYMENT_ROWS.manual,
      title: copy.manual,
      value: manual.length ? manual.join(', ') : copy.manualNone,
    },
  ]
  if (setup.primary !== null) {
    rows.push({
      id: PAYMENT_ROWS.capture,
      title: copy.capture,
      value: manualCapture.length
        ? copy.captureManual(manualCapture.join(', '))
        : copy.captureAutomatic,
    })
  }
  rows.push(
    {
      id: PAYMENT_ROWS.rules,
      title: copy.rules,
      value: ruleCount ? copy.rulesCount(ruleCount) : copy.rulesNone,
    },
    { id: PAYMENT_ROWS.more, title: copy.more, value: copy.moreValue },
  )
  return rows
}
