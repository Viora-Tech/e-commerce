import { gatewayKeySets, type PaymentMode, withKeySet } from '@commerce/core/payment-modes'
import type { FieldValues, SettingsBlob } from './provider-settings'

/*
 * A payments app with two key sets (Decentro) on the generic Connect page: the Live/Test
 * control picks which saved set is edited, and saving writes that set into its own slot.
 * Saving keys for the mode checkout is not using never switches checkout; that is the
 * Live/Test switch on Settings → Payments, which asks first.
 */

type Providers = SettingsBlob['providers']

/** `?keys=live` (a card's "Add live keys"), else the set checkout uses, else Test. */
export function initialKeySetMode(providers: Providers, id: string, search: string): PaymentMode {
  const asked = new URLSearchParams(search).get('keys')
  if (asked === 'test' || asked === 'live') return asked
  return gatewayKeySets(providers, id).active ?? 'test'
}

/** The saved set for `mode` (masked secrets) over the page's empty values, tagged with its mode. */
export function keySetValues(
  providers: Providers,
  id: string,
  mode: PaymentMode,
  empty: FieldValues,
): FieldValues {
  return { ...empty, ...(gatewayKeySets(providers, id)[mode] ?? {}), mode }
}

/** The blob to save: the edited set in its slot; checkout only picks it up when it is the set in use. */
export function withEditedKeySet(
  blob: SettingsBlob,
  id: string,
  mode: PaymentMode,
  values: FieldValues,
): SettingsBlob {
  const { providers, inUse } = withKeySet(blob.providers, id, mode, { ...values, mode })
  return {
    ...blob,
    enabled: inUse ? [...new Set([...blob.enabled, id])] : blob.enabled,
    providers,
  }
}
