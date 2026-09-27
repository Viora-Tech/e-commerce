'use client'

import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useRouter } from 'next/navigation'
import { accountContent } from '@/data/account'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { LOCALES, type Locale, localeCookie, parseLocale } from '@/lib/i18n'

type LanguageFieldProps = {
  /** Called after the cookie is written, before the server re-render lands. */
  onChanged?: ((locale: Locale) => void) | undefined
}

/**
 * English or हिंदी. Writes the `admin_locale` cookie and asks the server to render again, so
 * the root layout reads the new language and every page (server and client) switches over.
 */
export default function LanguageField({ onChanged }: LanguageFieldProps) {
  // Hooks
  const copy = useCopy(accountContent)
  const locale = useLocale()
  const router = useRouter()

  // Event handlers
  const handleChange = (values: string[]) => {
    const next = values[0]
    if (!next || next === locale) return
    const chosen = parseLocale(next)
    // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party preference cookie.
    document.cookie = localeCookie(chosen)
    onChanged?.(chosen)
    router.refresh()
  }

  return (
    <ToggleGroup
      aria-label={copy.language.label}
      value={[locale]}
      onValueChange={handleChange}
      variant="outline"
      spacing={0}
    >
      {LOCALES.map((id) => (
        <ToggleGroupItem key={id} value={id} lang={id} className="px-3">
          {copy.language.options[id]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
