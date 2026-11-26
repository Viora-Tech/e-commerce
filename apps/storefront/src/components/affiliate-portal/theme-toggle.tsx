'use client'

import { Moon, Sun } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { affiliatePortalContent as copy } from '@/data/affiliate-portal'
import { PORTAL_THEME_COOKIE, PORTAL_THEME_MAX_AGE } from '@/lib/portal-theme'

/** Light or dark for the portal, kept in a cookie so the next page paints right away. */
export default function ThemeToggle() {
  // Event handlers
  const handleToggle = () => {
    const dark = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.classList.toggle('light', !dark)
    // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie, read by the layout
    document.cookie = `${PORTAL_THEME_COOKIE}=${dark ? 'dark' : 'light'}; path=/; max-age=${PORTAL_THEME_MAX_AGE}; samesite=lax`
  }

  // Render logic
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleToggle}
      aria-label={copy.theme.toggle}
      title={copy.theme.toggle}
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
