/**
 * Whether a request to the admin's API came from another site or origin, by the browser's
 * own `Sec-Fetch-Site` header (every current browser sends it; a script cannot change it).
 *
 * The session cookie is `SameSite=Lax`, which still rides on requests from another origin
 * of the same site: any storefront on the admin's registrable domain (`waimers.in` next to
 * `admin.waimers.in`, where an imported theme's JavaScript runs) could post a form to
 * `/api/rpc` and act as the signed-in merchant. The admin only ever calls its API from its
 * own pages, so anything but `same-origin` is refused. Requests without the header (server
 * code, curl, tests) carry no browser cookies and are left to the session check.
 */
export function isCrossOriginBrowserRequest(headers: Headers): boolean {
  const site = headers.get('sec-fetch-site')
  return site !== null && site !== 'same-origin' && site !== 'none'
}
