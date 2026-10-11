import type { PreviewSample } from '@commerce/plugin-shopify-import/client'
import Image from 'next/image'
import StatusChip from '@/components/layout/status-chip'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { RESOURCE_ICON } from './run-resource-icons'

type RunSampleRowProps = { sample: PreviewSample }

const TONE = { create: 'success', update: 'info', skip: 'neutral' } as const

/** One record: a thumbnail (or its type glyph), the title, detail chips and what happens to it. */
export default function RunSampleRow({ sample }: RunSampleRowProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)

  // Render logic
  const Icon = RESOURCE_ICON[sample.resource]
  const details = sample.detail
    ? sample.detail
        .split(', ')
        .map((d) => d.trim())
        .filter(Boolean)
    : []

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-muted text-muted-foreground [&_svg]:size-4">
        {sample.image ? (
          <Image
            src={sample.image}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <Icon />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 truncate font-medium text-ink-strong sm:flex-1">
          {sample.title}
        </span>
        {details.length ? (
          <span className="flex flex-wrap gap-1.5">
            {details.map((d) => (
              <span
                key={d}
                className="rounded-md bg-muted px-1.5 py-0.5 text-caption text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <StatusChip tone={TONE[sample.action]} className="shrink-0">
        {copy.sampleAction[sample.action]}
      </StatusChip>
    </li>
  )
}
