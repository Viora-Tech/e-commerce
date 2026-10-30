/** SOURCE OF TRUTH: menus the live theme uses — WHAT: per menu handle, whether the live theme's header, footer or another section picks it (the Header section's `menu`, an imported theme's `link_list` settings in its section groups and templates) / WHY: Menus showed "Not used yet" on the main menu because only the Navigation setting was checked, while the theme picks its menu in the Header section (#92) */
import { navigationMenu, type StoreTx, theme, themeFile, themeTemplate } from '@commerce/db'
import { and, eq, like } from 'drizzle-orm'

export type ThemeMenuPlacement = 'header' | 'footer' | 'page'

/* A setting that picks a menu: `menu`, `main_menu`, `footer_menu`, `menu_handle`, `link_list`… */
const MENU_KEY = /menu|link_?list/i

/** Every handle in `handles` that a menu-picking setting anywhere in `value` names. */
function collectMenuHandles(value: unknown, handles: Set<string>, into: Set<string>, key = '') {
  if (typeof value === 'string') {
    if (MENU_KEY.test(key) && handles.has(value)) into.add(value)
  } else if (Array.isArray(value)) {
    for (const v of value) collectMenuHandles(v, handles, into, key)
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectMenuHandles(v, handles, into, k)
  }
}

/** Where a template or theme file sits on the page: the header group, the footer group or a page. */
function placementOf(name: string): ThemeMenuPlacement {
  if (/header/i.test(name)) return 'header'
  if (/footer/i.test(name)) return 'footer'
  return 'page'
}

/**
 * Per menu handle, the places of the live theme that pick it: its templates (Puck data; the
 * header and footer groups are templates too) and an imported theme's JSON files
 * (`sections/header-group.json`, `templates/index.json`). The Navigation setting's main and
 * footer menus are not included; the admin adds those itself.
 */
export async function menuThemePlacements(
  tx: StoreTx,
): Promise<Record<string, ThemeMenuPlacement[]>> {
  const menus = await tx.select({ handle: navigationMenu.handle }).from(navigationMenu)
  const handles = new Set(menus.map((m) => m.handle))
  const [live] = await tx.select({ id: theme.id }).from(theme).where(eq(theme.role, 'main'))
  if (!live || handles.size === 0) return {}
  const templates = await tx
    .select({ template: themeTemplate.template, sections: themeTemplate.sections })
    .from(themeTemplate)
    .where(eq(themeTemplate.themeId, live.id))
  const files = await tx
    .select({ path: themeFile.path, body: themeFile.body })
    .from(themeFile)
    .where(
      and(
        eq(themeFile.themeId, live.id),
        eq(themeFile.encoding, 'utf8'),
        like(themeFile.path, '%.json'),
      ),
    )
  const sources: { place: ThemeMenuPlacement; value: unknown }[] = [
    ...templates.map((t) => ({ place: placementOf(t.template), value: t.sections })),
    ...files.flatMap((f) => {
      try {
        // Shopify writes a `/* … */` notice at the top of generated JSON files.
        const json = f.body.replace(/^\s*\/\*[\s\S]*?\*\//, '')
        return [{ place: placementOf(f.path), value: JSON.parse(json) as unknown }]
      } catch {
        return []
      }
    }),
  ]
  const out: Record<string, ThemeMenuPlacement[]> = {}
  for (const { place, value } of sources) {
    const found = new Set<string>()
    collectMenuHandles(value, handles, found)
    for (const handle of found) {
      const list = out[handle] ?? []
      if (!list.includes(place)) out[handle] = [...list, place]
    }
  }
  return out
}
