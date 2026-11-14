/**
 * How many rows each settings page's first screen lists (`SettingsDrill`), so its route
 * `loading.tsx` and the page itself, while its own data loads, draw the same row-list skeleton
 * (`SectionPageSkeleton rows`) and the screen does not swap one loading picture for another.
 * Counts are the rows a store usually sees (rows only shown in development are left out).
 */
export const SETTINGS_SKELETON_ROWS = {
  ai: 4,
  appearance: 3,
  approvals: 2,
  checkout: 10,
  costs: 4,
  customerAccounts: 5,
  mcp: 4,
  notifications: 4,
  policies: 3,
  privacy: 4,
  returns: 4,
  shipping: 6,
  staff: 3,
  store: 4,
  taxes: 5,
} as const
