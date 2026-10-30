import { fromMinor, parseRupees } from '@commerce/money'
import {
  cellValue,
  type GridRow,
  PRODUCT_COLUMNS,
  parsePaise,
  parseTags,
  withCell,
} from './bulk-edit-model'

const MONEY_ACTIONS = [
  'increaseAmount',
  'decreaseAmount',
  'increasePercent',
  'decreasePercent',
  'setAmount',
] as const

/**
 * What "Change for all" can do to each column (#985, #1000). `priceAndMrp` moves the price and
 * the compare-at price together, so a sale keeps its gap.
 */
export const SET_ALL_ACTIONS = {
  price: MONEY_ACTIONS,
  mrp: [...MONEY_ACTIONS, 'clearAmount'],
  priceAndMrp: ['increaseAmount', 'decreaseAmount', 'increasePercent', 'decreasePercent'],
  cost: MONEY_ACTIONS,
  status: ['setStatus'],
  vendor: ['setText'],
  productType: ['setText'],
  tags: ['addTags', 'removeTags', 'replaceTags'],
} as const

export type SetAllKey = keyof typeof SET_ALL_ACTIONS
export type SetAllAction = (typeof SET_ALL_ACTIONS)[SetAllKey][number]
export type MoneyAction = (typeof MONEY_ACTIONS)[number]
export type SetAllChange = { key: SetAllKey; action: SetAllAction; value: string }

export const SET_ALL_KEYS = Object.keys(SET_ALL_ACTIONS) as SetAllKey[]

export const isMoneyAction = (action: SetAllAction): action is MoneyAction =>
  (MONEY_ACTIONS as readonly string[]).includes(action)

export const isPercentAction = (action: SetAllAction) =>
  action === 'increasePercent' || action === 'decreasePercent'

/** Actions with nothing to type (the vendor and type may be set to blank to clear them). */
export const needsValue = (action: SetAllAction) =>
  action !== 'clearAmount' && action !== 'setText'

/**
 * The typed amount as minor units (₹ amounts) or a percent; null when it cannot be used.
 * A decrease never goes past 100%.
 */
export function parseChangeValue(action: MoneyAction, text: string): number | null {
  if (isPercentAction(action)) {
    const n = Number(text.replace(/[%\s]/g, ''))
    if (!Number.isFinite(n) || n <= 0) return null
    return action === 'decreasePercent' && n > 100 ? null : n
  }
  const minor = parseRupees(text.replace(/[₹,\s]/g, ''))
  if (minor === null) return null
  return action === 'setAmount' || minor > 0 ? minor : null
}

/** One amount moved by an action; never below zero, rounded to the whole minor unit. */
export function adjustMinor(minor: number, action: MoneyAction, by: number): number {
  const next =
    action === 'increaseAmount'
      ? minor + by
      : action === 'decreaseAmount'
        ? minor - by
        : action === 'increasePercent'
          ? (minor * (100 + by)) / 100
          : action === 'decreasePercent'
            ? (minor * (100 - by)) / 100
            : by
  return Math.max(0, Math.round(next))
}

/** A money cell's text after the change. A blank amount stays blank unless it is set. */
export function adjustMoneyText(text: string, action: MoneyAction, by: number): string {
  const minor = parsePaise(text)
  if (action === 'setAmount') return String(fromMinor(by))
  if (minor === null || Number.isNaN(minor)) return text
  return String(fromMinor(adjustMinor(minor, action, by)))
}

function nextTags(current: string, action: SetAllAction, value: string): string {
  const now = parseTags(current)
  const typed = parseTags(value)
  if (action === 'addTags') return [...new Set([...now, ...typed])].join(', ')
  if (action === 'removeTags') {
    const drop = new Set(typed.map((t) => t.toLowerCase()))
    return now.filter((t) => !drop.has(t.toLowerCase())).join(', ')
  }
  return typed.join(', ')
}

function changeRow(row: GridRow, { key, action, value }: SetAllChange): GridRow {
  if (key === 'price' || key === 'mrp' || key === 'cost' || key === 'priceAndMrp') {
    const cells: readonly string[] = key === 'priceAndMrp' ? ['price', 'mrp'] : [key]
    if (action === 'clearAmount') return cells.reduce((r, k) => withCell(r, k, ''), row)
    if (!isMoneyAction(action)) return row
    const by = parseChangeValue(action, value)
    if (by === null) return row
    return cells.reduce(
      (r, k) => withCell(r, k, adjustMoneyText(cellValue(r, k), action, by)),
      row,
    )
  }
  if (key === 'tags') return withCell(row, 'tags', nextTags(row.tags, action, value))
  return withCell(row, key, value.trim())
}

/**
 * One change laid over the chosen variants (all of them when `only` is null); the grid still
 * needs Save to keep it. A product cell changes on every variant of a chosen product, so the
 * product's rows never disagree.
 */
export function applyToRows(
  rows: GridRow[],
  change: SetAllChange,
  only: ReadonlySet<string> | null,
): GridRow[] {
  const productLevel = (PRODUCT_COLUMNS as readonly string[]).includes(change.key)
  const products = new Set(
    rows.filter((r) => only === null || only.has(r.variantId)).map((r) => r.productId),
  )
  return rows.map((r) => {
    const chosen = productLevel
      ? products.has(r.productId)
      : only === null || only.has(r.variantId)
    return chosen ? changeRow(r, change) : r
  })
}
