'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import DataCard from '@/components/layout/data-card'
import { onlineStoreContent } from '@/data/online-store'
import { useCopy } from '@/hooks/use-copy'

type PageVisibilityCardProps = { visible: boolean; onChange: (visible: boolean) => void }

/** Visible to shoppers or hidden, as Shopify's page visibility card. */
export default function PageVisibilityCard({ visible, onChange }: PageVisibilityCardProps) {
  // Hooks
  const {
    form: { visibility: copy },
  } = useCopy(onlineStoreContent)

  // Render logic
  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-4">
      <RadioGroup
        value={visible ? 'visible' : 'hidden'}
        onValueChange={(v) => onChange(v === 'visible')}
      >
        {(['visible', 'hidden'] as const).map((option) => (
          <Field key={option} orientation="horizontal">
            <RadioGroupItem id={`page-visibility-${option}`} value={option} />
            <FieldLabel htmlFor={`page-visibility-${option}`} className="font-normal">
              {copy[option]}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      <p className="text-body text-muted-foreground">
        {visible ? copy.visibleHelp : copy.hiddenHelp}
      </p>
    </DataCard>
  )
}
