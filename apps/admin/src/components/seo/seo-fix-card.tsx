'use client'

import type { SeoReport } from '@commerce/core'
import { AiIcon } from '@commerce/ui/icons'
import KitButton from '@/components/kit/kit-button'
import SettingsCard from '@/components/settings/settings-card'
import { seoReportContent } from '@/data/seo-report'
import { useCopy } from '@/hooks/use-copy'

export type SeoFixField = keyof SeoReport['fixable']

type SeoFixCardProps = {
  fixable: SeoReport['fixable']
  /** Write with AI is on for the store and allowed for this member. */
  aiOn: boolean
  /** Most products one AI run takes (the API's bulk limit). */
  max: number
  onFix: (field: SeoFixField) => void
}

const FIELDS: readonly SeoFixField[] = ['seo', 'altText', 'description']

/** "Fix with AI": one button per kind of gap the report found, each starting a bulk AI run. */
export default function SeoFixCard({ fixable, aiOn, max, onFix }: SeoFixCardProps) {
  // Hooks
  const copy = useCopy(seoReportContent.fix)

  // Render logic
  const available = FIELDS.filter((field) => fixable[field].length > 0)
  const capped = available.some((field) => fixable[field].length > max)

  return (
    <SettingsCard title={copy.heading} description={copy.body}>
      {!aiOn ? (
        <p className="text-body text-muted-foreground">{copy.off}</p>
      ) : available.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.nothing}</p>
      ) : (
        <div className="flex flex-col items-start gap-2">
          {available.map((field) => (
            <KitButton key={field} variant="secondary" onClick={() => onFix(field)}>
              <AiIcon className="size-4" />
              {copy[field](fixable[field].length)}
            </KitButton>
          ))}
          {capped ? <p className="text-caption text-muted-foreground">{copy.capped(max)}</p> : null}
        </div>
      )}
    </SettingsCard>
  )
}
