'use client'

import type { CsvResource } from '@commerce/plugin-shopify-import/client'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'

type CsvHelpProps = {
  /** The kind chosen on the left: its details sit under the three steps. */
  resource: CsvResource
}

/** The right column of the CSV tab: three steps to get the file, then what is read from it. */
export default function CsvHelp({ resource }: CsvHelpProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.csv)

  // Render logic
  const kind = copy.kinds[resource]

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-hairline bg-card p-5">
      <h2 className="text-card-title text-ink-strong">{copy.howTo.heading}</h2>
      <ol className="flex flex-col gap-3">
        {copy.howTo.steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-ink-strong tabular-nums"
            >
              {i + 1}
            </span>
            <span className="pt-0.5 text-body text-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-1 border-t border-hairline pt-4">
        <p className="text-body-strong text-ink-strong">{copy.howTo.moreFor(kind.label)}</p>
        <p className="text-body text-muted-foreground">{kind.help}</p>
      </div>
    </aside>
  )
}
