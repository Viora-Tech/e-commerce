/**
 * A second, fully server-rendered load of a not-found page under an imported Shopify theme.
 *
 * Next answers `notFound()` with status 404 and an empty error shell (`<html id="__next_error__">`):
 * React cannot catch the error while rendering HTML, so the browser draws the whole page from
 * the RSC payload instead. Our own themes survive that. An imported theme does not: its markup
 * reaches the page only through the HTML render (`lib/liquid-slots.ts`) and its scripts only run
 * when the HTML is parsed, so the 404 showed bare, with no header, footer or stylesheets.
 *
 * So when a Liquid slot finds no server markup to keep (`components/theme/liquid-slot.tsx`), the
 * browser sets this cookie for the path and reloads once. With the cookie, the store layout puts
 * its page inside a Suspense boundary: the not-found error stays inside it, the shell (theme
 * head, header, footer, scripts) renders on the server as on every other page, and only the
 * not-found section is drawn in the browser. The first answer keeps its 404 for crawlers and
 * link checkers; the reload, seen only by a browser that ran our script, answers 200 with
 * `noindex`. A `wc_` cookie, so a shared cache never keeps that answer (`lib/edge-cache.ts`).
 */

export const RERENDER_COOKIE = 'wc_rerender'

const MAX_AGE_SECONDS = 60

/** This page has asked for the reload: its cookie must survive until the next load reads it. */
let reloading = false

/**
 * The cookie's value for a path: a short hash, so it needs no escaping and reads the same in
 * `document.cookie` and in the server's parsed cookies.
 */
export function rerenderValue(pathname: string): string {
  let hash = 5381
  for (let i = 0; i < pathname.length; i++) hash = (hash * 33 + pathname.charCodeAt(i)) >>> 0
  return hash.toString(36)
}

/** Whether a request for `pathname` carrying `cookie` is the themed reload. Server and browser. */
export function isRerender(cookie: string | undefined, pathname: string): boolean {
  return cookie !== undefined && cookie === rerenderValue(pathname)
}

/** The cookie's value in `document.cookie`, if set. */
export function readRerenderCookie(cookies: string): string | undefined {
  const prefix = `${RERENDER_COOKIE}=`
  return cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
}

/**
 * Reloads this page once in the themed mode. Does nothing when this load already was the
 * reload, so a page that still has no server markup never loops. Browser only.
 */
export function rerenderThemed() {
  const path = location.pathname
  if (isRerender(readRerenderCookie(document.cookie), path)) return
  reloading = true
  document.cookie = `${RERENDER_COOKIE}=${rerenderValue(path)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`
  // The bare page drawn so far is not worth a glimpse.
  document.documentElement.style.visibility = 'hidden'
  location.reload()
}

/** Drops the cookie once the themed reload has drawn. Browser only. */
export function clearRerender() {
  if (reloading || readRerenderCookie(document.cookie) === undefined) return
  document.cookie = `${RERENDER_COOKIE}=; path=/; max-age=0; samesite=lax`
}
