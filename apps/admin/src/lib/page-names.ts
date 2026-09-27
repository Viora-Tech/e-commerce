import { hindiNavGroups, hindiPageNames } from '@/data/hi/navigation'
import type { Locale } from '@/lib/i18n'

/** A page's name by route: its Hindi name when there is one, else the English `fallback`. */
export function pageName(href: string, fallback: string, locale: Locale): string {
  if (locale === 'en') return fallback
  return hindiPageNames[href]?.title ?? fallback
}

/** A settings page's one-line summary by route, same fallback rule as `pageName`. */
export function pageBody(href: string, fallback: string, locale: Locale): string {
  if (locale === 'en') return fallback
  return hindiPageNames[href]?.body ?? fallback
}

/** A sidebar group heading ("Main menu") in `locale`. */
export function navGroupName(label: string, locale: Locale): string {
  if (locale === 'en') return label
  return hindiNavGroups[label] ?? label
}

type NamedItem = { href: string; label: string; children?: { href: string; label: string }[] }

/** Sidebar items (and their children) with each label in `locale`, looked up by route. */
export function localizeNavItems<T extends NamedItem>(items: T[], locale: Locale): T[] {
  if (locale === 'en') return items
  return items.map((item) => ({
    ...item,
    label: pageName(item.href, item.label, locale),
    ...(item.children
      ? {
          children: item.children.map((c) => ({ ...c, label: pageName(c.href, c.label, locale) })),
        }
      : {}),
  }))
}
