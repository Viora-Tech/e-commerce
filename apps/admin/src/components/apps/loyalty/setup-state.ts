/**
 * What Home and Placements need for the setup bar and the status chips, in one read: whether
 * the program is live, the base earn rate as a percent of spend, and the live theme (its editor
 * path and app embed switches). The theme read may fail on its own: the page then shows no
 * embed status and no Customize links rather than an error.
 */
import type { LoyaltySettings } from '@commerce/core/loyalty'
import { api } from '@/lib/api-client'
import { spendDraftOf } from '@/lib/loyalty-program'
import { routes } from '@/lib/routes'

export type LoyaltySetupData = {
  settings: LoyaltySettings
  /** Rewards given back as a percent of spend: points per ₹100 on the base rule, each point ₹1. */
  ratePercent: number
  /** The live theme, null when there is none; undefined when the theme read failed. */
  theme:
    | { editor: string; appEmbeds: Record<string, { enabled: boolean }> | null }
    | null
    | undefined
  /** The floating widget's app embed is on in the live theme. */
  placementsOn: boolean
  /** The store's public origin (View page links); null when it could not be read. */
  origin: string | null
}

/** Settings, the earn rules and the live theme, read together. */
export async function loadSetupData(): Promise<LoyaltySetupData> {
  const [settings, rules, themes, origin] = await Promise.all([
    api.loyalty.settings.get(),
    api.loyalty.rules.list(),
    api.themes.list().catch(() => null),
    api.store.origin().catch(() => null),
  ])
  const spend = spendDraftOf(rules, settings)
  const live = themes?.find((t) => t.role === 'main') ?? null
  const theme =
    themes === null
      ? undefined
      : live
        ? {
            editor: routes.onlineStore.themeEditor(live.id),
            appEmbeds: live.settings.appEmbeds ?? null,
          }
        : null
  return {
    settings,
    ratePercent: spend.enabled ? spend.points : 0,
    theme,
    placementsOn: Boolean(theme?.appEmbeds?.['loyalty/Widget']?.enabled),
    origin: typeof origin === 'string' ? origin : null,
  }
}
