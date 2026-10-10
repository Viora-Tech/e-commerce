'use client'

import { type Permission, permissions } from '@commerce/core/permissions'
import { Settings } from '@commerce/ui/icons'
import {
  PAGE_LINKS,
  type PaletteLink,
  paletteContent,
  QUICK_ACTIONS,
  SETTINGS_LINKS,
} from '@/data/command-palette'
import { SETTINGS_SEARCH_INDEX } from '@/data/settings-search'
import { useCopy, useLocale } from '@/hooks/use-copy'
import type { PaletteSearch } from '@/hooks/use-palette-search'
import type { Locale } from '@/lib/i18n'
import { pageName } from '@/lib/page-names'
import {
  buildSections,
  flattenRows,
  type LinkRow,
  type PaletteRow,
  type PaletteSection,
  resultCount,
} from '@/lib/palette-rows'
import {
  matchesWords,
  type PaletteScope,
  type RecentEntry,
  settingsBreadcrumb,
} from '@/lib/palette-search'
import { routes } from '@/lib/routes'
import { searchSettings } from '@/lib/settings-search'

const IDLE_PAGES = 8

/** A page link named in the member's language, with its section as the trail. */
function localizeLink(link: PaletteLink, locale: Locale, account: string): LinkRow {
  const hint = link.hintHref
    ? pageName(link.hintHref, link.hint ?? '', locale)
    : link.hint === paletteContent.account
      ? account
      : link.hint
  return {
    href: link.href,
    label: pageName(link.href, link.label, locale),
    icon: link.icon,
    ...(hint ? { hint } : {}),
    ...(link.shortcut ? { shortcut: link.shortcut } : {}),
  }
}

const allowed = (link: { permission?: Permission }, can: (p: Permission) => boolean) =>
  !link.permission || can(link.permission)

export type PaletteView = {
  /** What is on screen: nothing when empty, only Ask AI while records load. */
  shown: PaletteSection[]
  rows: PaletteRow[]
  loading: boolean
  empty: boolean
  /** Results found (not Ask AI or See all), for the screen-reader line. */
  count: number
}

/**
 * Everything the palette lists for the current query and scope: the records the server found,
 * plus quick actions, pages and settings matched here (permission-checked, named in the
 * member's language), arranged into sections.
 */
export function usePaletteSections(input: {
  query: string
  scope: PaletteScope
  search: PaletteSearch
  aiEnabled: boolean
  recents: RecentEntry[]
  can: (p: Permission) => boolean
}): PaletteView {
  // Hooks
  const copy = useCopy(paletteContent)
  const locale = useLocale()
  const { query, scope, search, aiEnabled, recents, can } = input

  // Render logic
  const links = PAGE_LINKS.filter((l) => allowed(l, can)).map((l) =>
    localizeLink(l, locale, copy.account),
  )
  const pages =
    query || scope === 'pages'
      ? links.filter((l) => matchesWords([l.label, l.hint], query))
      : links.filter((l) => !l.hint).slice(0, IDLE_PAGES)
  const actions: LinkRow[] = QUICK_ACTIONS.filter((a) => allowed(a, can))
    .map((a) => ({ href: a.href, label: copy.actions[a.id], icon: a.icon }))
    .filter((a) => matchesWords([a.label], query))
  const settings: LinkRow[] = !can(permissions.SETTINGS_READ)
    ? []
    : query
      ? searchSettings(SETTINGS_SEARCH_INDEX, query).map((e) => ({
          href: e.href,
          label: e.title,
          hint: settingsBreadcrumb(e.where, copy.settings, copy.breadcrumbSeparator),
          icon: Settings,
        }))
      : SETTINGS_LINKS.map((l) => localizeLink(l, locale, copy.account))
  const sections = buildSections({
    query,
    scope,
    copy,
    aiEnabled,
    recents,
    orders: search.orders,
    products: search.products,
    customers: search.customers,
    actions,
    pages,
    settings,
    themeLabel: matchesWords([copy.toggleTheme], query) ? copy.toggleTheme : null,
    listHrefs: {
      orders: routes.orders.list(),
      products: routes.products.list(),
      customers: routes.customers.list(),
    },
  })
  const count = resultCount(sections)
  const loading = search.status === 'loading'
  const empty = search.status === 'ready' && query.length > 0 && count === 0
  const shown = empty ? [] : loading ? sections.filter((s) => s.key === 'ask') : sections

  return { shown, rows: flattenRows(shown), loading, empty, count }
}
