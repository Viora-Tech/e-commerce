/** SOURCE OF TRUTH: member devices, user agent — WHAT: a signed-in device in plain words (browser, system, phone or computer) from its user agent / WHY: the Sessions and Sign-in & security pages name devices the way people know them; pure and client-safe */

export type DeviceKind = 'phone' | 'tablet' | 'computer'

export type DeviceDescription = {
  /** "Chrome", "Safari", "Edge"; null when the user agent does not say. */
  browser: string | null
  /** "Windows", "macOS", "Android", "iPhone"; null when unknown. */
  os: string | null
  kind: DeviceKind
}

/** Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari". */
const BROWSERS: [RegExp, string][] = [
  [/EdgA?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

/** "Chrome on Windows, computer" from a user agent; every part may be unknown. */
export function describeUserAgent(userAgent: string | null | undefined): DeviceDescription {
  const ua = userAgent ?? ''
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? null
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? null
  const kind: DeviceKind = /iPad|Tablet/.test(ua)
    ? 'tablet'
    : /Mobi|iPhone|Android/.test(ua)
      ? 'phone'
      : 'computer'
  return { browser, os, kind }
}
