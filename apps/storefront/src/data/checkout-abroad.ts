/** Checkout's address fields outside India (country zones); part of checkoutContent. */

/** An address outside India (country zones): no PIN code, a free-text region and postcode. */
export const checkoutAbroadContent = {
  country: 'Country',
  line1: 'Address',
  line1Placeholder: 'Street address and number',
  line2: 'Apartment, suite, etc. (optional)',
  line2Required: 'Apartment, suite, etc.',
  line2Placeholder: 'Apartment 12',
  region: 'State, province or region',
  regionOptional: 'State, province or region (optional)',
  postcode: 'Postcode',
  postcodeOptional: 'Postcode (optional)',
  phone: 'Phone number',
  phoneHint: 'With the country code. The courier may call it on delivery.',
  phoneInvalid: 'Enter a phone number with its country code, like +61 412 345 678',
  postcodeMissing: 'Enter the postcode',
  postcodeInvalid: 'Enter a valid postcode for this country',
  regionMissing: 'Enter the state or province',
  regionInvalid: 'Pick the state or province from the list',
  /** The first entry of a listed country's region select (US states, Canadian provinces). */
  regionPick: 'Select',
  line2Missing: 'Enter the apartment or suite',
  shipsTo: (country: string) => `Ships to ${country}`,
  noCod: 'Cash on delivery is only offered for addresses in India.',
}
