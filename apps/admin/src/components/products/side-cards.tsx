'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { SuggestInput } from '@/components/fields/suggest-input'
import { TagInput } from '@/components/fields/tag-input'
import { productFormContent } from '@/data/products'

const copy = productFormContent

const statusItems = Object.fromEntries(copy.status.options.map((o) => [o.value, o.label]))

type StatusCardProps = { status: ProductStatus; onChange: (status: ProductStatus) => void }

export function StatusCard({ status, onChange }: StatusCardProps) {
  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.status.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="product-status" className="sr-only">
            {copy.status.label}
          </FieldLabel>
          <Select
            items={statusItems}
            value={status}
            onValueChange={(s) => onChange(s as ProductStatus)}
          >
            <SelectTrigger size="lg" id="product-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {copy.status.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{copy.status.help[status]}</FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}

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

export function OrganisationCard({
  productType,
  vendor,
  tags,
  facets,
  onProductType,
  onVendor,
  onTags,
}: OrganisationCardProps) {
  return (
    <Card size="form">
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
