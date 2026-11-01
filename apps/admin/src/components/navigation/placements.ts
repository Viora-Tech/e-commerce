import type { NavigationSettings } from '@commerce/core/navigation'

export type MenuPlacement = 'header' | 'footer' | 'page'

/** Per menu handle, where the live theme's sections pick it (`navigation.themePlacements`). */
export type ThemeMenuPlacements = Record<string, MenuPlacement[]>

/**
 * Where the storefront uses this menu's handle: the Navigation setting's main and footer menus,
 * plus every place the live theme picks it (the Header section's menu, an imported theme's
 * menu settings in its header and footer groups or on a page).
 */
export function placementsFor(
  handle: string,
  settings: NavigationSettings,
  theme: ThemeMenuPlacements = {},
): MenuPlacement[] {
  const placements = new Set<MenuPlacement>(theme[handle] ?? [])
  if (settings.main === handle) placements.add('header')
  if (settings.footer.includes(handle)) placements.add('footer')
  return (['header', 'footer', 'page'] as const).filter((p) => placements.has(p))
}
