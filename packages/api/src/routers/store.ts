import { loadEnv } from '@commerce/config'
import {
  builtInPaymentRegistry,
  decryptPaymentSettings,
  encryptPaymentSettings,
  isEncryptedSecret,
  maskPaymentSettings,
  PaymentSettingsSchema,
  parsePaymentSettings,
  parseTheme,
  ThemeSchema,
} from '@commerce/core'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { ORPCError } from '@orpc/server'
import { storeProcedure } from '../procedures'
import { getStore, updateStorePayments, updateStoreTheme } from '../services/store.service'

const registry = builtInPaymentRegistry().register(razorpayFactory)
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
      available: registry.ids().map((id) => {
        const f = registry.get(id)
        return { id, label: f?.label ?? id, fields: f?.fields ?? [] }
      }),
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
        const f = registry.get(id)
        if (!f) throw new ORPCError('BAD_REQUEST', { message: `Unknown payment provider ${id}` })
        const check = f.validateConfig(
          Object.fromEntries(
            Object.entries(merged.providers[id] ?? {}).map(([k, v]) => [
              k,
              isEncryptedSecret(v) ? 'x'.repeat(8) : v,
            ]),
          ),
        )
        if (!check.ok) {
          throw new ORPCError('BAD_REQUEST', { message: `${f.label}: ${check.errors.join(', ')}` })
        }
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
