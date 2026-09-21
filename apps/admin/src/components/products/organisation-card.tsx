'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import SuggestInput from '@/components/fields/suggest-input'
import TagInput from '@/components/fields/tag-input'
import { productFormContent } from '@/data/products'

const copy = productFormContent

export type Facets = { vendors: string[]; productTypes: string[]; tags: string[] }

type OrganisationCardProps = {
  productType: string
  vendor: string
  tags: string[]
  facets: Facets
  onProductType: (value: string) => void
  onVendor: (value: string) => void
  onTags: (tags: string[]) => void
}

export default function OrganisationCard({
  productType,
  vendor,
  tags,
  facets,
  onProductType,
  onVendor,
  onTags,
}: OrganisationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.organisation.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="product-type">{copy.organisation.type}</FieldLabel>
            <SuggestInput
              id="product-type"
              value={productType}
              suggestions={facets.productTypes}
              onChange={onProductType}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="product-vendor">{copy.organisation.vendor}</FieldLabel>
            <SuggestInput
              id="product-vendor"
              value={vendor}
              suggestions={facets.vendors}
              onChange={onVendor}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="product-tags">{copy.organisation.tags}</FieldLabel>
            <TagInput
              id="product-tags"
              tags={tags}
              suggestions={facets.tags}
              onChange={onTags}
              placeholder={copy.organisation.tagsPlaceholder}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
