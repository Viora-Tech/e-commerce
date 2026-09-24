import type { PreorderPaymentMode, PreorderSettings } from './settings'

export type DepositAmounts = {
  /** Charged at checkout now. */
  depositPaise: number
  /** Owed later; fulfilment is blocked while this is greater than zero. */
  balancePaise: number
}

/**
 * Split one line's total into what is charged now and what is deferred.
 * `fixed` deposits are a flat amount per unit (so a quantity of 2 charges
 * `depositPaise * 2`, never a partial unit); `percentage` rounds to the
 * nearest paise, since a rupee amount can't be split more finely. `full`
 * charges everything now.
 */
export function computeDeposit(
  linePaise: number,
  mode: PreorderPaymentMode,
  opts: { depositPaise?: number | null; depositPercent?: number | null; quantity?: number } = {},
): DepositAmounts {
  if (linePaise < 0) throw new Error('linePaise must not be negative')
  if (mode === 'full') return { depositPaise: linePaise, balancePaise: 0 }
  if (mode === 'fixed') {
    const perUnit = opts.depositPaise ?? 0
    const quantity = opts.quantity ?? 1
    const deposit = Math.min(perUnit * quantity, linePaise)
    return { depositPaise: deposit, balancePaise: linePaise - deposit }
  }
  // percentage
  const pct = opts.depositPercent ?? 0
  const deposit = Math.round((linePaise * pct) / 100)
  const clamped = Math.min(Math.max(deposit, 0), linePaise)
  return { depositPaise: clamped, balancePaise: linePaise - clamped }
}

/** `computeDeposit` from a resolved `PreorderSettings`, for callers that already merged product + variant. */
export function computeDepositFromSettings(
  linePaise: number,
  settings: Pick<PreorderSettings, 'paymentMode' | 'depositPaise' | 'depositPercent'>,
  quantity = 1,
): DepositAmounts {
  return computeDeposit(linePaise, settings.paymentMode, {
    depositPaise: settings.depositPaise,
    depositPercent: settings.depositPercent,
    quantity,
  })
}

/** Copy for "Pay ₹X now, ₹Y later" on the storefront; paise formatted by the caller. */
export type DepositPreview = { payNowPaise: number; payLaterPaise: number }

export function depositPreview(amounts: DepositAmounts): DepositPreview {
  return { payNowPaise: amounts.depositPaise, payLaterPaise: amounts.balancePaise }
}
