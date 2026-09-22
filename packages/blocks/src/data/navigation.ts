/** Every string the storefront header and its menus show. */
export const navigationContent = {
  primary: 'Primary',
  mobile: 'Menu',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  /** The parent's own link, offered inside its dropdown, mega menu or drawer section. */
  viewAll: (label: string) => `All ${label}`,
  search: 'Search',
  account: 'Account',
  cart: (count: number) => `Cart, ${count} items`,
} as const

/** Hover intent: wait this long before opening a menu, so a pointer passing over does not flash it. */
export const MENU_OPEN_DELAY_MS = 120

/** And this long before closing, so a pointer can cross the gap into the panel. */
export const MENU_CLOSE_DELAY_MS = 220
