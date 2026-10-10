'use client'

import Link from 'next/link'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ImportedThemeSettingsProps = {
  themeId: string
}

/**
 * The Theme settings panel for a theme imported from Shopify: its colours, fonts and
 * layout come from the theme's own settings, so our presets do not apply here.
 */
export default function ImportedThemeSettings({ themeId }: ImportedThemeSettingsProps) {
  // Hooks
  const { editor: copy } = useCopy(themeImportContent)

  // Render logic
  return (
    <div className="flex flex-col gap-3 px-4 pb-4 text-body">
      <p className="font-medium text-foreground">{copy.settingsTitle}</p>
      <p className="text-muted-foreground">{copy.settingsBody}</p>
      <Link
        href={routes.onlineStore.themeImport(themeId)}
        className="text-foreground underline underline-offset-4"
      >
        {copy.report}
      </Link>
    </div>
  )
}
