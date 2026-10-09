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
import { useCopy } from '@/hooks/use-copy'

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
  anyLabel: string
  onChange: (next: string | null) => void
}

/** Select needs a value, so this stands for "no filter". */
const ANY = '__any'

function FilterSelect({ id, label, value, options, anyLabel, onChange }: FilterSelectProps) {
  const items = Object.fromEntries([[ANY, anyLabel], ...options.map((o) => [o.value, o.label])])
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
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
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
  // Hooks
  const { filters: copy } = useCopy(blogListContent)

  // Render logic
  return (
    <div className="flex w-64 flex-col gap-4">
      <FilterSelect
        anyLabel={copy.any}
        id="filter-blog"
        label={copy.blog}
        value={values.blog}
        options={blogs}
        onChange={(blog) => onChange({ blog })}
      />
      <FilterSelect
        anyLabel={copy.any}
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
