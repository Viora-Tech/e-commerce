'use client'

import type { ImportedAppEmbed } from '@commerce/core/theme-import'
import { cn } from '@commerce/ui/lib/utils'
import { themeEditorAppsContent } from '@/data/theme-editor-apps'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_BODY, CHROME_GROUP_LABEL, CHROME_LABEL, CHROME_META } from '@/lib/customize-chrome'

type ImportedAppEmbedsListProps = {
  /** The app embeds in the imported theme's settings (`current.blocks`). */
  embeds: readonly ImportedAppEmbed[]
}

/** Our app's name for the embeds it draws. */
const OUR_APP: Record<NonNullable<ImportedAppEmbed['ours']>, string> = {
  inbox: 'Inbox',
  reviews: 'Reviews',
}

/**
 * The Shopify app embeds an imported theme was saved with, read-only under the App embeds panel:
 * which one of our apps draws each, and which have no app here. They stay in the theme's settings
 * whatever is shown; nothing here can remove them.
 */
export default function ImportedAppEmbedsList({ embeds }: ImportedAppEmbedsListProps) {
  // Hooks
  const copy = useCopy(themeEditorAppsContent)

  // Early returns
  if (embeds.length === 0) return null

  // Render logic
  return (
    <section className="flex w-full flex-col gap-2 text-left">
      <h3 className={CHROME_GROUP_LABEL}>{copy.importedEmbeds}</h3>
      <p className={cn(CHROME_BODY, 'text-muted-foreground')}>{copy.importedEmbedsNote}</p>
      <ul className="flex flex-col gap-1.5">
        {embeds.map((e) => {
          const status = !e.enabled
            ? copy.embedOff
            : e.ours
              ? copy.embedOurs(OUR_APP[e.ours])
              : copy.embedMissing
          return (
            <li
              key={e.id}
              className="flex flex-col rounded-lg border border-dashed border-border px-3 py-2"
            >
              <span className={cn(CHROME_LABEL, 'truncate text-foreground')}>{e.name}</span>
              <span className={cn(CHROME_META, 'truncate')}>{status}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
