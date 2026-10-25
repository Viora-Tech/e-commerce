import type { ShippingProvider } from './types'

/** India, or no country given (every address before international couriers existed). */
export function isDomesticCountry(country: string | null | undefined): boolean {
  const c = country?.trim().toUpperCase()
  return !c || c === 'IN' || c === 'IND' || c === 'INDIA'
}

/**
 * Whether a courier delivers to this country at all, from its declared `coverage`. Asked
 * before any API call, so a domestic courier is never sent a foreign postal code and an
 * export-only courier (DHL Express, FedEx) is never asked about an Indian PIN code.
 */
export function servesDestination(
  provider: Pick<ShippingProvider, 'coverage'>,
  country: string | null | undefined,
): boolean {
  const coverage = provider.coverage ?? 'domestic'
  if (coverage === 'both') return true
  return isDomesticCountry(country) ? coverage === 'domestic' : coverage === 'international'
}
