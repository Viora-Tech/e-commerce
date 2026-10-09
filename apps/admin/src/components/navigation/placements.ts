import type { NavigationSettings } from '@commerce/core/navigation'

export type MenuPlacement = 'header' | 'footer'

/** Where the storefront uses this menu's handle. */
export function placementsFor(handle: string, settings: NavigationSettings): MenuPlacement[] {
  const placements: MenuPlacement[] = []
  if (settings.main === handle) placements.push('header')
  if (settings.footer.includes(handle)) placements.push('footer')
  return placements
}
