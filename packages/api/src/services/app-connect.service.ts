import { loadEnv, settingsSecret, workerPublicUrl } from '@commerce/config'
import { parseShippingSettings } from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import type { ProviderField } from '@commerce/payments'
import type { PluginManifest } from '@commerce/plugins'
import { ORPCError } from '@orpc/server'
import { storeRegistries } from './apps.service'
import { connectPaymentGateway, testPaymentConnection } from './payments-setup.service'
import { prepareProviderSettings } from './provider-settings'
import { testShippingConnection, updateStoreShipping } from './shipping.service'
import { getStore } from './store.service'

/**
 * The install flow's first step, "Connect account": the account fields of an app that is not
 * installed yet, a read-only test of what the merchant typed, and saving them as part of the
 * install. Only apps whose account is one courier or one key-based gateway connect here; the
 * rest (OAuth, buckets, senders) connect on their own page after installing.
 */

export type ConnectKind = 'shipping' | 'payments'

export type ConnectForm = {
  providerId: string
  kind: ConnectKind
  label: string
  /** The fields the merchant must fill to connect; the optional ones stay on the app's page. */
  fields: Pick<ProviderField, 'key' | 'label' | 'secret' | 'help' | 'generate'>[]
}

/** Gateways that connect with pasted keys (Razorpay also offers OAuth on its own page). */
const KEY_GATEWAYS = new Set(['razorpay', 'cashfree'])

function onlyOne<T>(items: T[]): T | null {
  return items.length === 1 ? (items[0] ?? null) : null
}

/** The one account an app connects in the install flow, or null when it connects on its own page. */
export function connectFormFor(plugin: PluginManifest): ConnectForm | null {
  const pick = (f: { id: string; label: string; fields: ProviderField[] }, kind: ConnectKind) => ({
    providerId: f.id,
    kind,
    label: f.label,
    fields: f.fields
      .filter((x) => (x.required || x.connect) && !x.hidden)
      .map((x) => ({
        key: x.key,
        label: x.label,
        ...(x.secret ? { secret: true } : {}),
        ...(x.help ? { help: x.help } : {}),
        ...(x.generate ? { generate: true } : {}),
      })),
  })
  const shipping = plugin.provides.shipping ?? []
  const payments = (plugin.provides.payments ?? []).filter((f) => !f.credentialsFrom)
  const others =
    (plugin.provides.notifications ?? []).length + (plugin.provides.storage ?? []).length
  if (others > 0) return null
  const courier = payments.length === 0 ? onlyOne(shipping) : null
  if (courier) return pick(courier, 'shipping')
  const gateway = shipping.length === 0 ? onlyOne(payments) : null
  if (gateway && KEY_GATEWAYS.has(gateway.id)) return pick(gateway, 'payments')
  return null
}

function pluginOrThrow(id: string): PluginManifest {
  const p = getRegistries().plugins.find((x) => x.id === id)
  if (!p || p.id === 'core') throw new ORPCError('NOT_FOUND', { message: `No app "${id}"` })
  return p
}

function formOrThrow(pluginId: string, providerId: string): ConnectForm {
  const form = connectFormFor(pluginOrThrow(pluginId))
  if (!form || form.providerId !== providerId) {
    throw new ORPCError('BAD_REQUEST', { message: 'This app connects on its own page.' })
  }
  return form
}

const secrets = () => {
  const env = loadEnv(process.env)
  return {
    secret: settingsSecret(),
    previousSecrets: env.SETTINGS_SECRET_PREVIOUS,
    workerUrl: workerPublicUrl(env),
  }
}

/**
 * "Test connection" before the app is installed: the same read-only check the app's own
 * Connect page runs, against the deployment's registry (the store's own registry only lists
 * installed apps). Nothing is saved.
 */
export async function testAppConnection(
  tx: StoreTx,
  storeId: string,
  pluginId: string,
  providerId: string,
  fields: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  const form = formOrThrow(pluginId, providerId)
  const all = getRegistries()
  if (form.kind === 'shipping') {
    const r = await testShippingConnection(
      tx,
      storeId,
      all.shipping,
      secrets().secret,
      providerId,
      fields,
    )
    return { ok: r.ok, message: r.message }
  }
  const r = await testPaymentConnection(tx, storeId, all.payments, secrets(), providerId, fields)
  return { ok: r.ok, message: r.message ?? '' }
}

/**
 * Save the account typed in the install flow and switch it on. Runs right after the install in
 * the same transaction, so the store's registry already lists the app's provider; the usual
 * validation and encryption of the settings pages apply.
 */
export async function saveAppConnection(
  tx: StoreTx,
  storeId: string,
  pluginId: string,
  providerId: string,
  fields: Record<string, string>,
): Promise<void> {
  const form = formOrThrow(pluginId, providerId)
  const env = secrets()
  const registries = await storeRegistries(tx, storeId)
  if (form.kind === 'payments') {
    await connectPaymentGateway(tx, storeId, registries.payments, env, providerId, fields)
    return
  }
  const current = parseShippingSettings((await getStore(tx, storeId))?.shipping)
  const input = {
    ...current,
    enabled: [...new Set([...current.enabled, providerId])],
    providers: {
      ...current.providers,
      [providerId]: { ...(current.providers[providerId] ?? {}), ...fields },
    },
  }
  const next = prepareProviderSettings(input, current, registries.shipping, env.secret, 'courier')
  await updateStoreShipping(tx, storeId, next)
}
