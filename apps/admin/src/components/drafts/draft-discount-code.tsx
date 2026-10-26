'use client'

import { BadgePercent, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import type { DraftCodeCheck } from '@/components/drafts/draft-form-state'
import { draftEditorContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'

type DraftDiscountCodeProps = {
  /** The applied code, '' for none. */
  code: string
  /** The latest check of `code`; null while there is none. */
  check: DraftCodeCheck | null
  disabled?: boolean
  /** Check a typed code; resolves with the server's answer. */
  onApply: (typed: string) => Promise<DraftCodeCheck>
  onApplied: (code: string) => void
  onRemove: () => void
}

/**
 * "Apply discount code" on a draft order (issue #795): a store code checked with checkout's
 * rules, shown as a removable chip with what it takes off, or the reason it does not apply.
 */
export default function DraftDiscountCode({
  code,
  check,
  disabled = false,
  onApply,
  onApplied,
  onRemove,
}: DraftDiscountCodeProps) {
  // Hooks
  const {
    totals: { code: copy },
  } = useCopy(draftEditorContent)
  const fmt = useFormat()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleApply = async () => {
    const typed = text.trim()
    if (!typed) return
    setBusy(true)
    setError(null)
    try {
      const r = await onApply(typed)
      if (r.ok) {
        setText('')
        onApplied(r.code)
      } else {
        setError(copy.rejected[r.reason])
      }
    } catch {
      setError(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const applied = code && check?.ok ? check : null
  const stale = code && check && !check.ok ? copy.rejected[check.reason] : null

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="draft-discount-code" className="text-xs text-muted-foreground">
        {copy.label}
      </label>
      {code ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 text-body">
            <BadgePercent aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium uppercase text-ink-strong">{code}</span>
            {applied ? (
              <span className="truncate text-caption text-muted-foreground">
                {applied.label} ·{' '}
                {applied.amountPaise > 0
                  ? copy.off(fmt.money(applied.amountPaise))
                  : applied.freeShipping
                    ? copy.freeShipping
                    : copy.off(fmt.money(0))}
              </span>
            ) : null}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.remove}
            title={copy.remove}
            disabled={disabled}
            onClick={onRemove}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            id="draft-discount-code"
            value={text}
            placeholder={copy.placeholder}
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleApply()
              }
            }}
            className="h-9 w-full uppercase placeholder:normal-case"
          />
          <Button
            variant="outline"
            disabled={disabled || busy || !text.trim()}
            loading={busy}
            onClick={handleApply}
          >
            {copy.apply}
          </Button>
        </div>
      )}
      {error ? <p className="text-caption text-destructive">{error}</p> : null}
      {stale ? (
        <p className="text-caption text-destructive">
          {copy.stale} {stale}
        </p>
      ) : null}
      {!code && !error ? <p className="text-caption text-muted-foreground">{copy.help}</p> : null}
    </div>
  )
}
