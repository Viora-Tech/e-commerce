'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import {
  Autocomplete,
  BlockStack,
  Card,
  InlineStack,
  Select,
  Tag,
  Text,
  TextField,
} from '@shopify/polaris'
import { type FormEvent, useState } from 'react'
import { productFormContent } from '@/data/products'

const copy = productFormContent

type StatusCardProps = { status: ProductStatus; onChange: (status: ProductStatus) => void }

export function StatusCard({ status, onChange }: StatusCardProps) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h2" variant="headingSm">
          {copy.status.heading}
        </Text>
        <Select
          label={copy.status.label}
          labelHidden
          options={[...copy.status.options]}
          value={status}
          onChange={(s) => onChange(s as ProductStatus)}
          helpText={copy.status.help[status]}
        />
      </BlockStack>
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
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          {copy.organisation.heading}
        </Text>
        <SuggestField
          label={copy.organisation.type}
          value={productType}
          suggestions={facets.productTypes}
          onChange={onProductType}
        />
        <SuggestField
          label={copy.organisation.vendor}
          value={vendor}
          suggestions={facets.vendors}
          onChange={onVendor}
        />
        <TagsField tags={tags} suggestions={facets.tags} onChange={onTags} />
        <TextField
          label={copy.organisation.collections}
          value=""
          onChange={() => {}}
          disabled
          helpText={copy.organisation.collectionsSoon}
          autoComplete="off"
        />
      </BlockStack>
    </Card>
  )
}

type SuggestFieldProps = {
  label: string
  value: string
  suggestions: string[]
  onChange: (value: string) => void
}

/** Free text with the store's existing values offered as you type. */
function SuggestField({ label, value, suggestions, onChange }: SuggestFieldProps) {
  const matches = suggestions
    .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
    .slice(0, 8)

  return (
    <Autocomplete
      options={matches.map((s) => ({ value: s, label: s }))}
      selected={[]}
      onSelect={([picked]) => picked && onChange(picked)}
      textField={
        <Autocomplete.TextField
          label={label}
          value={value}
          onChange={onChange}
          autoComplete="off"
        />
      }
    />
  )
}

type TagsFieldProps = { tags: string[]; suggestions: string[]; onChange: (tags: string[]) => void }

function TagsField({ tags, suggestions, onChange }: TagsFieldProps) {
  const [input, setInput] = useState('')

  const add = (tag: string) => {
    const t = tag.trim()
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) return
    onChange([...tags, t])
  }
  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag))

  const matches = suggestions
    .filter((s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s))
    .slice(0, 8)

  // Enter adds the typed tag; Polaris' Autocomplete only reports picks from the list.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    add(input)
    setInput('')
  }

  return (
    <BlockStack gap="200">
      <form onSubmit={handleSubmit}>
        <Autocomplete
          options={matches.map((s) => ({ value: s, label: s }))}
          selected={[]}
          onSelect={([picked]) => {
            if (picked) add(picked)
            setInput('')
          }}
          textField={
            <Autocomplete.TextField
              label={copy.organisation.tags}
              value={input}
              onChange={setInput}
              placeholder={copy.organisation.tagsPlaceholder}
              autoComplete="off"
              onBlur={() => {
                add(input)
                setInput('')
              }}
            />
          }
        />
      </form>
      {tags.length ? (
        <InlineStack gap="100" wrap>
          {tags.map((t) => (
            <Tag key={t} onRemove={() => remove(t)}>
              {t}
            </Tag>
          ))}
        </InlineStack>
      ) : null}
    </BlockStack>
  )
}
