'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { blogListContent } from '@/data/blog'

export type ArticleFilterValues = { blog: string | null; tag: string | null }

type Option = { value: string; label: string }

type ArticleFiltersProps = {
  values: ArticleFilterValues
  blogs: Option[]
  tags: string[]
  onChange: (patch: Partial<ArticleFilterValues>) => void
  onClear: () => void
}

type FilterSelectProps = {
  id: string
  label: string
  value: string | null
  options: Option[]
  onChange: (next: string | null) => void
}

const copy = blogListContent.filters
/** Select needs a value, so this stands for "no filter". */
const ANY = '__any'

function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  const items = Object.fromEntries([[ANY, copy.any], ...options.map((o) => [o.value, o.label])])
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={value ?? ANY}
        onValueChange={(next) => onChange(next === ANY ? null : String(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{copy.any}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/** Contents of the filter popover on the blog post list. */
export default function ArticleFilters({
  values,
  blogs,
  tags,
  onChange,
  onClear,
}: ArticleFiltersProps) {
  // Render logic
  return (
    <div className="flex w-64 flex-col gap-4">
      <FilterSelect
        id="filter-blog"
        label={copy.blog}
        value={values.blog}
        options={blogs}
        onChange={(blog) => onChange({ blog })}
      />
      <FilterSelect
        id="filter-tag"
        label={copy.tag}
        value={values.tag}
        options={tags.map((t) => ({ value: t, label: t }))}
        onChange={(tag) => onChange({ tag })}
      />
      <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
        {copy.clear}
      </Button>
    </div>
  )
}
