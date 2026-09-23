import { ACCENT_COOKIE, accentCss, readAccentCookie } from '@commerce/core/admin-accent'
import { cookies } from 'next/headers'
import { appRouter, call, serverContext } from '@/lib/api'
import AccentCookieSync from './accent-cookie-sync'

type AccentStyleProps = {
  /** The active store's organization; null before a store is picked. */
  organizationId: string | null
}

/** The member's accent from the database, or undefined when it cannot be read. */
async function loadEffectiveAccent(): Promise<string | null | undefined> {
  try {
    const r = await call(appRouter.appearance.get, undefined, { context: await serverContext() })
    return r.effective
  } catch {
    return undefined
  }
}

/**
 * Injects the merchant's admin accent as a style block in the server HTML, so the first
 * paint already has it: no flash, and nothing for hydration to disagree with (the block
 * carries both the light and the dark values; next-themes picks by class). Reads the
 * short-lived cookie first and falls back to the database, then refreshes the cookie.
 */
export default async function AccentStyle({ organizationId }: AccentStyleProps) {
  // Early returns
  if (!organizationId) return null

  // Render logic
  const jar = await cookies()
  const cached = readAccentCookie(jar.get(ACCENT_COOKIE)?.value, organizationId)
  const accent = cached === undefined ? await loadEffectiveAccent() : cached
  const css = accentCss(accent)

  return (
    <>
      {css ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: accentCss builds this only from a validated hex and derived numbers; anything else yields ''.
        <style dangerouslySetInnerHTML={{ __html: css }} />
      ) : null}
      {cached === undefined && accent !== undefined ? (
        <AccentCookieSync organizationId={organizationId} accent={accent} />
      ) : null}
    </>
  )
}
