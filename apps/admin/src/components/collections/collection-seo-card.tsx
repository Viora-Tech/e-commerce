'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { collectionFormContent as copy } from '@/data/collections'

type CollectionSeoCardProps = {
  seoTitle: string
  seoDescription: string
  onChange: (patch: { seoTitle?: string; seoDescription?: string }) => void
}

export default function CollectionSeoCard({
  seoTitle,
  seoDescription,
  onChange,
}: CollectionSeoCardProps) {
  // Render logic
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.seo.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="collection-seo-title">{copy.seo.title}</FieldLabel>
          <Input
            id="collection-seo-title"
            size="lg"
            value={seoTitle}
            onChange={(e) => onChange({ seoTitle: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="collection-seo-description">{copy.seo.description}</FieldLabel>
          <Textarea
            id="collection-seo-description"
            size="lg"
            rows={3}
            value={seoDescription}
            onChange={(e) => onChange({ seoDescription: e.target.value })}
          />
        </Field>
      </CardContent>
    </Card>
  )
}
