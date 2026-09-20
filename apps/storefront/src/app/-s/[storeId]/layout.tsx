import { parseTheme, themeToCss } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { archivo, figtree, fontVar } from '@/lib/fonts'
import { inStore } from '@/lib/store-context'
import { htmlThemeAttr, parseThemeMode, THEME_COOKIE } from '@/lib/theme-mode'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

export default async function StoreLayout({ children, params }: Props) {
  const { storeId } = await params
  const current = await inStore(storeId, async (tx) => {
    const [s] = await tx.select().from(store).where(eq(store.id, storeId))
    return s
  })
  if (!current) notFound()

  const theme = parseTheme(current.theme)
  const mode = parseThemeMode((await cookies()).get(THEME_COOKIE)?.value, theme.darkMode.default)
  const fontStyle = `:root{--font-heading:${fontVar[theme.fonts.heading]};--font-body:${fontVar[theme.fonts.body]}}`

  return (
    <html
      lang="en"
      data-theme={htmlThemeAttr(mode)}
      className={`${archivo.variable} ${figtree.variable}`}
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: `${themeToCss(theme)}\n${fontStyle}` }} />
      </head>
      <body className="min-h-screen antialiased">
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <a href="/" className="font-heading text-lg font-bold tracking-tight">
            {current.name}
          </a>
          {theme.darkMode.enabled && theme.darkMode.togglePosition === 'header' ? (
            <ThemeToggle initial={mode} />
          ) : null}
        </header>
        {children}
        {theme.darkMode.enabled && theme.darkMode.togglePosition === 'footer' ? (
          <footer className="border-t border-line px-6 py-4">
            <ThemeToggle initial={mode} />
          </footer>
        ) : null}
      </body>
    </html>
  )
}
