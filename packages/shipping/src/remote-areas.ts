/**
 * Remote parts of India where parcels take longer than the mainland (#104): the islands, and
 * the north-east hill states. Used only when no courier answered with its own transit days,
 * so the store's default "3 to 6 days" does not promise Port Blair the same as Delhi.
 * Matched on PIN code prefixes (India Post circles and districts).
 */
const REMOTE_PREFIXES: readonly { prefix: string; extraDays: number }[] = [
  // Andaman & Nicobar Islands: 744xxx.
  { prefix: '744', extraDays: 4 },
  // Lakshadweep: 682551 to 682559.
  { prefix: '68255', extraDays: 5 },
  // Sikkim: 737xxx.
  { prefix: '737', extraDays: 2 },
  // Arunachal Pradesh, Meghalaya, Manipur, Mizoram, Nagaland, Tripura: 790xxx to 799xxx.
  { prefix: '79', extraDays: 2 },
  // Ladakh: 194xxx.
  { prefix: '194', extraDays: 3 },
]

/** Extra transit days for a remote PIN code; 0 for the mainland. */
export function remoteExtraDays(pincode: string): number {
  return REMOTE_PREFIXES.find((r) => pincode.startsWith(r.prefix))?.extraDays ?? 0
}
