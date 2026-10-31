import type { ChipTone } from '@/components/status/tone'
import type { GatewayApp, PaymentsSetup } from './types'

export type ProviderStatus = 'active' | 'inactive' | 'test' | 'attention'

export const PROVIDER_TONE: Record<ProviderStatus, ChipTone> = {
  active: 'success',
  inactive: 'neutral',
  test: 'attention',
  attention: 'danger',
}

/** A provider at a glance: off at checkout, with a health problem, on test keys, or fine. */
export function providerStatus(gateway: GatewayApp, setup: PaymentsSetup): ProviderStatus {
  if (!gateway.connected) return 'inactive'
  if (setup.primary?.id === gateway.id && setup.primary.problems.length > 0) return 'attention'
  if (gateway.mode === 'test') return 'test'
  return 'active'
}

/** The providers worth a row: saved keys or on at checkout, the main one first. */
export function listedProviders(setup: PaymentsSetup): GatewayApp[] {
  const rows = setup.gateways.filter((g) => g.configured || g.connected)
  const mainId = setup.primary?.id
  return [...rows.filter((g) => g.id === mainId), ...rows.filter((g) => g.id !== mainId)]
}

/** The provider checkout tries first when several are on (`routing.gateways` is in order). */
export function mainProviderId(setup: PaymentsSetup): string | null {
  return setup.routing.gateways.find((g) => g.active)?.id ?? setup.primary?.id ?? null
}
