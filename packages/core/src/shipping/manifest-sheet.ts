/** SOURCE OF TRUTH: groupManifestRows, findManifestFor, manifestTotals
 * WHAT:  the pure rules behind a printed pickup manifest: which parcels share one manifest (same
 *        courier, same pickup), when a manifest already on file is the same one (exactly the
 *        same shipments), and the totals printed under the list.
 * WHY:   "Print manifest" in Shipments › To be picked up reuses the manifest made with the
 *        pickup instead of stacking a new row on every print, and the PDF and its tests read the
 *        same totals.
 * WHERE: `printManifestSheet` (packages/api manifest-sheet.service.ts); the PDF itself is drawn
 *        by manifest-pdf.ts. Pure (no database), so the admin reads it from
 *        `@commerce/core/manifest-sheet`.
 */

/** Parcels on one printed manifest file at most (a busy day's pickups fit well inside it). */
export const MANIFEST_SHEET_MAX = 500

/** One parcel on a printed manifest. */
export type ManifestLine = {
  waybill: string
  orderNumber: number | null
  shipToName: string | null
  city: string | null
  pincode: string | null
  weightGrams: number | null
  /** Cash on delivery (the courier collects `codPaise`) or prepaid. */
  cod: boolean
  codPaise: number
}

/** One courier pickup's manifest: a page (or more) of the printed file. */
export type ManifestSection = {
  /** Our manifest row, printed as a short reference so a reprint can be matched. */
  manifestId: string
  courier: string
  /** `YYYY-MM-DD`, the day the pickup is booked for; null when the parcels have no pickup. */
  pickupDate: string | null
  pickupPlace: string | null
  lines: ManifestLine[]
}

export type ManifestGroup<T> = { provider: string; pickupId: string | null; rows: T[] }

/**
 * Parcels split into one manifest per courier pickup (a pickup belongs to one courier; parcels
 * with no pickup group by courier), in the order the rows came.
 */
export function groupManifestRows<T extends { provider: string; pickupId: string | null }>(
  rows: readonly T[],
): ManifestGroup<T>[] {
  const groups = new Map<string, ManifestGroup<T>>()
  for (const row of rows) {
    const key = `${row.provider}|${row.pickupId ?? ''}`
    let group = groups.get(key)
    if (!group) {
      group = { provider: row.provider, pickupId: row.pickupId, rows: [] }
      groups.set(key, group)
    }
    group.rows.push(row)
  }
  return [...groups.values()]
}

/** Whether two id lists hold exactly the same shipments, in any order. */
export function sameShipmentSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a)
  const right = new Set(b)
  if (left.size !== right.size) return false
  for (const id of right) if (!left.has(id)) return false
  return true
}

/** The newest manifest on file for exactly these shipments with this courier, if any. */
export function findManifestFor<M extends { provider: string; shipmentIds: string[] }>(
  manifests: readonly M[],
  provider: string,
  shipmentIds: readonly string[],
): M | undefined {
  return manifests.find(
    (m) => m.provider === provider && sameShipmentSet(m.shipmentIds, shipmentIds),
  )
}

export type ManifestTotals = {
  parcels: number
  codParcels: number
  codPaise: number
  prepaidParcels: number
  /** Sum of the weights known; parcels with no weight add nothing. */
  weightGrams: number
}

/** The count line under a manifest's list. */
export function manifestTotals(lines: readonly ManifestLine[]): ManifestTotals {
  let codParcels = 0
  let codPaise = 0
  let weightGrams = 0
  for (const line of lines) {
    if (line.cod) {
      codParcels += 1
      codPaise += line.codPaise
    }
    weightGrams += line.weightGrams ?? 0
  }
  return {
    parcels: lines.length,
    codParcels,
    codPaise,
    prepaidParcels: lines.length - codParcels,
    weightGrams,
  }
}
