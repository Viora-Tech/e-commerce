/** One row of a side-by-side diff: the old line on the left, the new one on the right. */
export type DiffRow = {
  left: { no: number; text: string; removed: boolean } | null
  right: { no: number; text: string; added: boolean } | null
}

/** Above this many line pairs the middle of a file is shown as replaced rather than matched. */
const MAX_CELLS = 4_000_000

/** Line numbers (1-based) of `next` that are new or changed compared with `prev`. */
export function changedLines(prev: string, next: string): Set<number> {
  const out = new Set<number>()
  for (const row of diffLines(prev, next)) {
    if (row.right?.added) out.add(row.right.no)
  }
  return out
}

/**
 * A line diff (longest common subsequence after trimming the shared start and end), as rows a
 * side-by-side view draws: unchanged lines face each other, removed lines sit on the left with
 * nothing opposite, added lines on the right.
 */
export function diffLines(prev: string, next: string): DiffRow[] {
  const a = prev.split('\n')
  const b = next.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const rows: DiffRow[] = []
  const same = (i: number, j: number) =>
    rows.push({
      left: { no: i + 1, text: a[i] ?? '', removed: false },
      right: { no: j + 1, text: b[j] ?? '', added: false },
    })
  const removed = (i: number) =>
    rows.push({ left: { no: i + 1, text: a[i] ?? '', removed: true }, right: null })
  const added = (j: number) =>
    rows.push({ left: null, right: { no: j + 1, text: b[j] ?? '', added: true } })

  for (let i = 0; i < start; i++) same(i, i)
  const n = endA - start
  const m = endB - start
  if (n * m > MAX_CELLS) {
    for (let i = start; i < endA; i++) removed(i)
    for (let j = start; j < endB; j++) added(j)
  } else {
    // lcs[i][j]: the longest common run of a[start+i..] and b[start+j..].
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
    for (let i = n - 1; i >= 0; i--) {
      const row = lcs[i] as Uint32Array
      const below = lcs[i + 1] as Uint32Array
      for (let j = m - 1; j >= 0; j--) {
        row[j] =
          a[start + i] === b[start + j]
            ? (below[j + 1] ?? 0) + 1
            : Math.max(below[j] ?? 0, row[j + 1] ?? 0)
      }
    }
    let i = 0
    let j = 0
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        same(start + i, start + j)
        i++
        j++
      } else if (j < m && (i === n || (lcs[i]?.[j + 1] ?? 0) >= (lcs[i + 1]?.[j] ?? 0))) {
        added(start + j)
        j++
      } else {
        removed(start + i)
        i++
      }
    }
  }
  for (let k = 0; endA + k < a.length; k++) same(endA + k, endB + k)
  return paired(rows)
}

/** A changed block's removed and added lines side by side, as editors show a changed line. */
function paired(rows: DiffRow[]): DiffRow[] {
  const out: DiffRow[] = []
  let i = 0
  while (i < rows.length) {
    const row = rows[i] as DiffRow
    if (!(row.left?.removed || row.right?.added)) {
      out.push(row)
      i++
      continue
    }
    const lefts: NonNullable<DiffRow['left']>[] = []
    const rights: NonNullable<DiffRow['right']>[] = []
    while (i < rows.length) {
      const r = rows[i] as DiffRow
      if (r.left?.removed) lefts.push(r.left)
      else if (r.right?.added) rights.push(r.right)
      else break
      i++
    }
    for (let k = 0; k < Math.max(lefts.length, rights.length); k++) {
      out.push({ left: lefts[k] ?? null, right: rights[k] ?? null })
    }
  }
  return out
}

/** How many rows changed (a changed line counts once). */
export function diffChangeCount(rows: readonly DiffRow[]): number {
  return rows.filter((r) => r.left?.removed || r.right?.added).length
}
