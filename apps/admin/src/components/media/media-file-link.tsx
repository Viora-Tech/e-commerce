'use client'

import { ChevronDown, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Input } from '@commerce/ui/shadcn/input'
import { useId } from 'react'
import CopyButton from '@/components/fields/copy-button'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'

type MediaFileLinkProps = {
  url: string
  /** Responsive copies from the upload pipeline, `{ [width]: { avif, webp } }`. */
  variants: Record<string, { avif: string; webp: string }> | null
}

/** The file page's Link card body: the public address with copy and open, and its optimised copies. */
export default function MediaFileLink({ url, variants }: MediaFileLinkProps) {
  // Hooks
  const { details: copy } = useCopy(mediaContent)
  const fieldId = useId()

  // Render logic
  const widths = Object.keys(variants ?? {}).sort((a, b) => Number(a) - Number(b))

  return (
    <section className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="sr-only">
        {copy.linkLabel}
      </label>
      <div className="flex items-center gap-1">
        <Input
          id={fieldId}
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 font-mono text-caption"
          aria-describedby={`${fieldId}-hint`}
        />
        <CopyButton value={url} what={copy.copyWhat} visible />
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<a href={url} target="_blank" rel="noopener noreferrer" />}
          aria-label={copy.openLink}
          title={copy.openLink}
        >
          <ExternalLink aria-hidden="true" />
        </Button>
      </div>
      <p id={`${fieldId}-hint`} className="text-caption text-muted-foreground">
        {copy.linkHint}
      </p>
      {variants && widths.length > 0 ? (
        <Collapsible className="mt-1">
          <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 rounded-md text-caption font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronDown
              className="size-4 transition-transform group-data-panel-open:rotate-180"
              aria-hidden="true"
            />
            {copy.optimised}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-1 text-caption text-muted-foreground">{copy.optimisedHint}</p>
            <ul className="mt-2 flex flex-col rounded-lg border border-line">
              {widths.flatMap((width) =>
                (['webp', 'avif'] as const).map((format) => {
                  const href = variants[width]?.[format]
                  if (!href) return null
                  const label = format.toUpperCase()
                  return (
                    <li
                      key={`${width}-${format}`}
                      className="flex items-center gap-2 border-b border-line px-3 py-1.5 last:border-0"
                    >
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-caption text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {copy.variant(width, label)}
                      </a>
                      <CopyButton value={href} what={copy.variantWhat(width, label)} visible />
                    </li>
                  )
                }),
              )}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}
