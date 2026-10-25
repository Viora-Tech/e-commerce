'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'

type LinkInputProps = {
  id: string
  value: unknown
  invalid?: boolean | undefined
  onChange: (value: unknown) => void
}

type LinkParts = { label: string; url: string }

function partsOf(value: unknown): LinkParts {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  return {
    label: typeof v.label === 'string' ? v.label : '',
    url: typeof v.url === 'string' ? v.url : '',
  }
}

/** A button link: the words on the button and where it goes, a web address or a store page. */
export default function LinkInput({ id, value, invalid, onChange }: LinkInputProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)

  // Helpers
  const set = (next: Partial<LinkParts>) => {
    const merged = { ...partsOf(value), ...next }
    onChange(merged.label.trim() === '' && merged.url.trim() === '' ? null : merged)
  }

  // Render logic
  const parts = partsOf(value)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-label`} className="text-caption font-normal text-muted-foreground">
          {copy.link.label}
        </Label>
        <Input
          id={`${id}-label`}
          size="lg"
          value={parts.label}
          maxLength={200}
          placeholder={copy.link.labelPlaceholder}
          onChange={(e) => set({ label: e.target.value })}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={id} className="text-caption font-normal text-muted-foreground">
          {copy.link.url}
        </Label>
        <Input
          id={id}
          size="lg"
          value={parts.url}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={copy.link.urlPlaceholder}
          aria-invalid={invalid || undefined}
          onChange={(e) => set({ url: e.target.value })}
        />
      </div>
    </div>
  )
}
