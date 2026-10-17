'use client'

import { SquareTerminal } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ImportedSectionNoteProps = {
  /** The section's file name in the theme (`featured-collection`). */
  sectionType: string
  /** `top`: the blue note under the name. `bottom`: "Open in Edit code" and the file path. */
  place: 'top' | 'bottom'
}

/**
 * An imported Shopify section in the inspector (Figma 698:92941): a note that its settings come
 * from its schema, and a way to its file in Edit code, where merchants change its markup.
 */
export default function ImportedSectionNote({ sectionType, place }: ImportedSectionNoteProps) {
  // Hooks
  const copy = useCopy(themeImportContent.inspector)
  const params = useParams<{ id: string }>()

  // Render logic
  const path = `sections/${sectionType}.liquid`

  if (place === 'top') {
    return (
      <div className="flex shrink-0 gap-2 rounded-lg border border-info-border bg-info-soft p-3 text-caption">
        <SquareTerminal aria-hidden className="mt-0.5 size-3.5 shrink-0 text-info" />
        <div className="flex flex-col gap-0.5">
          <p className="font-medium text-info">{copy.title}</p>
          <p className="text-info">{copy.body}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <Button
        variant="secondary"
        nativeButton={false}
        render={
          <Link
            href={`${routes.onlineStore.themeCode(params.id)}?file=${encodeURIComponent(path)}`}
          />
        }
      >
        {copy.openCode}
      </Button>
      <span className="font-mono text-caption text-muted-foreground">{path}</span>
    </div>
  )
}
