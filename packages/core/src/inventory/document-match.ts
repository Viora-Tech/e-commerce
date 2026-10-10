/** SOURCE OF TRUTH: matching lines read from a supplier document to purchase order lines —
 * WHAT: exact supplier code / SKU first, then HSN plus a fuzzy title score, else unmatched;
 * each order line is used at most once. WHY: the review screen proposes the match and the
 * merchant confirms or changes it; products are never created from a document. Pure, no
 * dependencies, client-safe through `@commerce/core/inventory`.
 */

/** Something a document line can be matched to: an order line, or a store variant by SKU. */
export type MatchCandidate = {
  /** The order line; null for a store variant that is not on the order yet. */
  lineId: string | null
  variantId: string
  sku: string | null
  /** Product and variant title, as the merchant sees it. */
  title: string
  hsnCode: string | null
}

/** One line as the document prints it. */
export type DocumentLineKey = {
  sku: string | null
  description: string | null
  hsnCode: string | null
}

export type MatchMethod = 'sku' | 'hsn_title' | 'title' | 'none'

export type LineMatch = {
  index: number
  lineId: string | null
  variantId: string | null
  method: MatchMethod
  /** 1 for a SKU match, the title score otherwise, 0 when unmatched. */
  score: number
}

/** Below this a title alone (or with its HSN) is not a match. */
const TITLE_MATCH_MIN = 0.5
const HSN_BONUS = 0.25

/** "M1-BLK" and "m1 blk" are the same code. */
export const normaliseSupplierCode = (code: string | null | undefined): string =>
  (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const tokens = (text: string | null | undefined): Set<string> =>
  new Set(
    (text ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2),
  )

/** Dice coefficient of the two titles' word sets: 1 for the same words, 0 for none shared. */
function titleSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const x = tokens(a)
  const y = tokens(b)
  if (x.size === 0 || y.size === 0) return 0
  let shared = 0
  for (const t of x) if (y.has(t)) shared += 1
  return (2 * shared) / (x.size + y.size)
}

/** Same HSN when both have one and they agree on the first six digits (the heading and sub-heading). */
function sameHsn(a: string | null, b: string | null): boolean {
  const x = normaliseSupplierCode(a)
  const y = normaliseSupplierCode(b)
  return x.length >= 6 && y.length >= 6 && x.slice(0, 6) === y.slice(0, 6)
}

/**
 * Matches every document line: SKU exact (order lines first, then store variants), then the
 * best remaining order line by title score with an HSN bonus, then nothing. Greedy, in the
 * document's order; a candidate is taken once.
 */
export function matchDocumentLines(
  lines: DocumentLineKey[],
  candidates: MatchCandidate[],
): LineMatch[] {
  const taken = new Set<MatchCandidate>()
  const result: LineMatch[] = lines.map((_, index) => ({
    index,
    lineId: null,
    variantId: null,
    method: 'none',
    score: 0,
  }))
  const onOrder = candidates.filter((c) => c.lineId !== null)
  const ordered = [...onOrder, ...candidates.filter((c) => c.lineId === null)]

  for (const [index, line] of lines.entries()) {
    const code = normaliseSupplierCode(line.sku)
    if (!code) continue
    const hit = ordered.find((c) => !taken.has(c) && normaliseSupplierCode(c.sku) === code)
    if (!hit) continue
    taken.add(hit)
    result[index] = { index, lineId: hit.lineId, variantId: hit.variantId, method: 'sku', score: 1 }
  }

  for (const [index, line] of lines.entries()) {
    if (result[index]?.method !== 'none') continue
    let best: { candidate: MatchCandidate; score: number; hsn: boolean } | null = null
    for (const c of onOrder) {
      if (taken.has(c)) continue
      const hsn = sameHsn(line.hsnCode, c.hsnCode)
      const score = titleSimilarity(line.description, c.title) + (hsn ? HSN_BONUS : 0)
      if (score >= TITLE_MATCH_MIN && (!best || score > best.score))
        best = { candidate: c, score, hsn }
    }
    if (!best) continue
    taken.add(best.candidate)
    result[index] = {
      index,
      lineId: best.candidate.lineId,
      variantId: best.candidate.variantId,
      method: best.hsn ? 'hsn_title' : 'title',
      score: Math.min(1, Number(best.score.toFixed(2))),
    }
  }
  return result
}
