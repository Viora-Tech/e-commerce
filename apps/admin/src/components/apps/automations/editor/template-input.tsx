'use client'

import { Braces } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useRef } from 'react'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { unknownMergeTags } from '@/lib/automation-labels'

type TemplateInputProps = {
  id: string
  value: string
  multiline: boolean
  maxLength?: number | undefined
  /** Merge tags the trigger's subject offers (`order.number`). */
  tags: string[]
  invalid?: boolean | undefined
  onChange: (value: string) => void
}

/** Text with `{order.number}` merge tags: an Insert menu at the caret and a note for unknown tags. */
export default function TemplateInput({
  id,
  value,
  multiline,
  maxLength,
  tags,
  invalid,
  onChange,
}: TemplateInputProps) {
  // Hooks
  const { panel: copy } = useCopy(automationEditorContent)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  // Event handlers
  const handleInsert = (tag: string) => {
    const el = ref.current
    const at = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? at
    const token = `{${tag}}`
    onChange(value.slice(0, at) + token + value.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + token.length, at + token.length)
    })
  }

  // Render logic
  const unknown = unknownMergeTags(value, tags)
  const field = multiline ? (
    <Textarea
      ref={ref}
      id={id}
      value={value}
      maxLength={maxLength}
      aria-invalid={invalid || undefined}
      rows={4}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <Input
      ref={ref}
      id={id}
      value={value}
      maxLength={maxLength}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  )

  return (
    <div className="flex flex-col gap-1.5">
      {field}
      <div className="flex items-start justify-between gap-2">
        {unknown.length > 0 ? (
          <p className="text-caption text-warning-foreground dark:text-warning">
            {copy.unknownTags(unknown.map((t) => `{${t}}`).join(', '))}
          </p>
        ) : (
          <span />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="shrink-0" />}>
            <Braces aria-hidden="true" />
            {copy.mergeTags}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-60 overflow-y-auto">
            {tags.map((tag) => (
              <DropdownMenuItem
                key={tag}
                onClick={() => handleInsert(tag)}
                className="font-mono text-xs"
              >
                {`{${tag}}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
