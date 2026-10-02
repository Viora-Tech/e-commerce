/**
 * Old settings addresses and where each one lives now (the October 2026 reorganisation into six
 * groups). `next.config.ts` serves them as redirects, so bookmarks, emails and links from other
 * apps keep working; the query string and the `#section` part of a link travel along.
 *
 * Temporary (307) rather than permanent: browsers cache a 308 for good, and settings may move
 * again. A test checks every source is gone from the app and every destination is a real page.
 */
export type SettingsRedirect = { source: string; destination: string }

export const SETTINGS_REDIRECTS: SettingsRedirect[] = [
  // "General" is now "Store details".
  { source: '/settings/general', destination: '/settings/store' },
  // "Business and GST" is the GST numbers tab (the first one) of Taxes & GST.
  { source: '/settings/business', destination: '/settings/taxes' },
  // "Customer privacy" is now "Privacy & data requests"; the request queue moved with it.
  { source: '/settings/customer-privacy', destination: '/settings/privacy' },
  { source: '/settings/customer-privacy/:path*', destination: '/settings/privacy/:path*' },
  // Personal preferences left store settings for the account menu.
  { source: '/settings/account', destination: '/account' },
  { source: '/settings/appearance', destination: '/account/appearance' },
  // Where uploads are stored sits with the files themselves, under Content → Files.
  { source: '/settings/files', destination: '/content/files/storage' },
]
