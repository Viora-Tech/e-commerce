/**
 * Copy for printing the pickup manifest in Shipments › To be picked up: the selection bar's
 * "Print manifest" and the tab's "Print all manifests". The printed PDF itself is drawn on the
 * server in English (packages/core manifest-pdf.ts).
 */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const manifestSheetContent = {
  /** Selection bar: the ticked parcels' manifest. */
  printSelected: 'Print manifest',
  /** Tab toolbar: one manifest per pickup, every parcel in To be picked up. */
  printAll: 'Print all manifests',
  printAllHint: 'One page per pickup, with a signature line for the courier’s pickup executive.',
  making: 'Making the manifest…',
  failed: 'Could not make the manifest. Try again.',
  tooMany: (max: number) =>
    `Print up to ${max} parcels on one manifest. Select fewer and try again.`,
  /** Toast after printing: "Manifest ready: 12 parcels on 2 pickups." */
  done: (parcels: number, pickups: number) =>
    `Manifest ready: ${plural(parcels, 'parcel', 'parcels')} on ${plural(pickups, 'pickup', 'pickups')}.`,
}
