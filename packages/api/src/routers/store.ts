import { loadEnv } from '@commerce/config'
import {
  decryptPaymentSettings,
  encryptPaymentSettings,
  isEncryptedSecret,
  maskPaymentSettings,
  PaymentRegistry,
  PaymentSettingsSchema,
  parsePaymentSettings,
  parseTheme,
  ThemeSchema,
} from '@commerce/core'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { storeProcedure } from '../procedures'
import { getStore, updateStorePayments, updateStoreTheme } from '../services/store.service'

const registry = new PaymentRegistry().register(razorpayFactory)
const secret = () => loadEnv(process.env).SETTINGS_SECRET

export const storeRouter = {
  current: storeProcedure.handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    return s ? { ...s, theme: parseTheme(s.theme), role: context.scope.role } : null
  }),

  updateTheme: storeProcedure
    .input(ThemeSchema)
    .handler(({ context, input }) => updateStoreTheme(context.tx, context.scope.storeId, input)),

  /** Payment settings with secrets masked, plus the gateways this deployment can offer. */
  getPayments: storeProcedure.handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const settings = parsePaymentSettings(s?.payments)
    return {
      settings: maskPaymentSettings(decryptPaymentSettings(settings, secret())),
      available: [
        {
          id: 'cod',
          label: 'Cash on delivery',
          fields: [] as { key: string; label: string; secret: boolean }[],
        },
        ...registry.ids().map((id) => ({
          id,
          label: registry.get(id)?.label ?? id,
          fields:
            id === 'razorpay'
              ? [
                  { key: 'keyId', label: 'Key ID', secret: false },
                  { key: 'keySecret', label: 'Key secret', secret: true },
                  { key: 'webhookSecret', label: 'Webhook secret', secret: true },
                ]
              : [],
        })),
      ],
    }
  }),

  /**
   * Save payment settings. A masked secret value (••••1234) means "unchanged":
   * the stored encrypted value is kept. Anything else is encrypted before saving.
   */
  updatePayments: storeProcedure
    .input(PaymentSettingsSchema)
    .handler(async ({ context, input }) => {
      const current = parsePaymentSettings(
        (await getStore(context.tx, context.scope.storeId))?.payments,
      )
      const merged = { ...input, providers: { ...input.providers } }
      for (const [id, cfg] of Object.entries(merged.providers)) {
        const prev = current.providers[id] ?? {}
        merged.providers[id] = Object.fromEntries(
          Object.entries(cfg).map(([k, v]) => [
            k,
            v.startsWith('••••') && (isEncryptedSecret(prev[k]) || prev[k])
              ? (prev[k] as string)
              : v,
          ]),
        )
      }
      for (const id of merged.enabled) {
        if (id === 'cod') continue
        const f = registry.get(id)
        if (!f) throw new Error(`unknown payment provider ${id}`)
        const check = f.validateConfig(
          Object.fromEntries(
            Object.entries(merged.providers[id] ?? {}).map(([k, v]) => [
              k,
              isEncryptedSecret(v) ? 'x'.repeat(8) : v,
            ]),
          ),
        )
        if (!check.ok) throw new Error(`${id}: ${check.errors.join(', ')}`)
      }
      const saved = await updateStorePayments(
        context.tx,
        context.scope.storeId,
        encryptPaymentSettings(merged, secret()),
      )
      return saved
        ? maskPaymentSettings(
            decryptPaymentSettings(parsePaymentSettings(saved.payments), secret()),
          )
        : null
    }),
}
