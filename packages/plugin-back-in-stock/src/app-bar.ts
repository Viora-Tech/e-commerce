import type { AppBarContext, AppBarSummary } from '@commerce/plugins'
import { waitingSummary } from './signups'

/** "128 shoppers waiting on 14 variants" (Figma 928:12095); one shopper, one variant read singular. */
export function waitingLabel(shoppers: number, variants: number): string {
  const who = shoppers === 1 ? '1 shopper' : `${shoppers.toLocaleString('en-IN')} shoppers`
  const what = variants === 1 ? '1 variant' : `${variants.toLocaleString('en-IN')} variants`
  return `${who} waiting on ${what}`
}

/**
 * The Back in stock app bar: the waiting-list pill and the Signups count in the sidebar, from
 * one statement. Signups are read under `settings.read` like the app's own pages; a member
 * without it sees neither. Nothing waiting shows no pill.
 */
export async function backInStockAppBar({
  tx,
  storeId,
  can,
}: Pick<AppBarContext, 'tx' | 'storeId' | 'can'>): Promise<AppBarSummary | null> {
  if (!can('settings.read')) return null
  const { shoppers, variants } = await waitingSummary(tx, storeId)
  if (shoppers === 0) return null
  return {
    statusPill: { label: waitingLabel(shoppers, variants), tone: 'neutral' },
    pageCounts: { signups: shoppers },
  }
}
