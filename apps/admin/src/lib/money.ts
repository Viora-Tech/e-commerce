const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function formatPaise(paise: number): string {
  return inr.format(paise / 100)
}

const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** ₹1.2L / ₹35K — for stat tiles and chart axes. */
export function formatPaiseCompact(paise: number): string {
  return inrCompact.format(paise / 100)
}

const numberCompact = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCompact(n: number): string {
  return numberCompact.format(n)
}
