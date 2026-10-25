'use client'

import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import DataCard from '@/components/layout/data-card'
import { onlineStoreContent } from '@/data/online-store'
import { useCopy } from '@/hooks/use-copy'

type SeoPatch = { handle?: string; seoTitle?: string; seoDescription?: string }

type PageSeoCardProps = {
  handle: string
  seoTitle: string
  seoDescription: string
  onChange: (patch: SeoPatch) => void
}

/** Handle, page title and meta description for search engines. */
export default function PageSeoCard({
  handle,
  seoTitle,
  seoDescription,
  onChange,
}: PageSeoCardProps) {
  // Hooks
  const {
    form: { seo: copy },
  } = useCopy(onlineStoreContent)

  // Render logic
  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="page-seo-title">{copy.seoTitle}</FieldLabel>
          <Input
            id="page-seo-title"
            size="lg"
            maxLength={70}
            value={seoTitle}
            onChange={(e) => onChange({ seoTitle: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="page-seo-description">{copy.seoDescription}</FieldLabel>
          <Textarea
            id="page-seo-description"
            size="lg"
            rows={3}
            maxLength={320}
            value={seoDescription}
            onChange={(e) => onChange({ seoDescription: e.target.value })}
          />
          <FieldDescription>{copy.help}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="page-handle">{copy.handle}</FieldLabel>
          <Input
            id="page-handle"
            size="lg"
            value={handle}
            onChange={(e) =>
              onChange({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
            }
          />
        </Field>
      </FieldGroup>
    </DataCard>
  )
}
