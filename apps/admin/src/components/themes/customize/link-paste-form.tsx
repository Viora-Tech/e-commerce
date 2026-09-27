'use client'

import { Globe } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { type FormEvent, useId, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { normalisePastedUrl } from '@/lib/customize-links'

type LinkPasteFormProps = {
  onPick: (href: string) => void
  /** Present only for link objects, which have somewhere to keep the switch (`newTab`). */
  newTab?: boolean | undefined
  onNewTab?: ((value: boolean) => void) | undefined
}

const copy = customizeContent.link

/**
 * The picker's footer: "Paste a link" for anything outside the store (checked
 * before it's used: http(s), mailto, tel, a site path or `#anchor` only), and
 * the "Open in a new tab" switch when the field can store it.
 */
export default function LinkPasteForm({ onPick, newTab, onNewTab }: LinkPasteFormProps) {
  // Hooks
  const [pasted, setPasted] = useState('')
  const [invalid, setInvalid] = useState(false)
  const switchId = useId()

  // Event handlers
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const href = normalisePastedUrl(pasted)
    if (!href) {
      setInvalid(true)
      return
    }
    onPick(href)
  }

  // Render logic
  return (
    <div className="flex flex-col gap-2 border-t border-border p-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-1">
        <label
          htmlFor={`${switchId}-url`}
          className="px-0.5 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          {copy.pasteHeading}
        </label>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Globe
              aria-hidden
              weight="light"
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={`${switchId}-url`}
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value)
                setInvalid(false)
              }}
              placeholder={copy.pastePlaceholder}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? `${switchId}-error` : undefined}
              inputMode="url"
              className="h-7 rounded-md pl-7 text-xs"
            />
          </div>
          <Button type="submit" size="xs" variant="outline" disabled={!pasted.trim()}>
            {copy.pasteApply}
          </Button>
        </div>
        {invalid ? (
          <p id={`${switchId}-error`} className="px-0.5 text-xs text-destructive">
            {copy.pasteInvalid}
          </p>
        ) : null}
      </form>
      {onNewTab ? (
        <label
          htmlFor={switchId}
          className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-0.5 text-xs text-foreground"
        >
          {copy.newTab}
          <Switch id={switchId} checked={newTab === true} onCheckedChange={(v) => onNewTab(v)} />
        </label>
      ) : null}
    </div>
  )
}
