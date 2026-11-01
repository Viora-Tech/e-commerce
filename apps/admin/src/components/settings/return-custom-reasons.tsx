'use client'

import { CUSTOM_REASON_MAX_LENGTH, MAX_CUSTOM_REASONS } from '@commerce/core/returns'
import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { returnCustomReasonsContent } from '@/data/returns'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'
import SettingsRow from './settings-row'

type ReturnCustomReasonsProps = {
  reasons: string[]
  onChange: (reasons: string[]) => void
}

/** Settings → Returns → Reasons: the store's own reasons, added and removed in place (#180). */
export default function ReturnCustomReasons({ reasons, onChange }: ReturnCustomReasonsProps) {
  // Hooks
  const copy = useCopy(returnCustomReasonsContent)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)

  // Event handlers
  const handleAdd = () => {
    const words = draft.trim()
    if (!words) return
    if (reasons.some((r) => r.toLowerCase() === words.toLowerCase())) {
      setError(copy.duplicate)
      return
    }
    onChange([...reasons, words])
    setDraft('')
    setError(undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleAdd()
  }

  // Render logic
  const full = reasons.length >= MAX_CUSTOM_REASONS

  return (
    <SettingsCard title={copy.title} description={copy.description}>
      {reasons.length > 0 ? (
        <ul className="flex flex-col">
          {reasons.map((r) => (
            <li
              key={r}
              className="flex items-center justify-between gap-3 border-b border-hairline py-2 text-body last:border-b-0"
            >
              <span className="min-w-0 break-words">{r}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.remove(r)}
                onClick={() => onChange(reasons.filter((x) => x !== r))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <SettingsRow
        label={copy.label}
        description={full ? copy.limit(MAX_CUSTOM_REASONS) : undefined}
        htmlFor="returns-custom-reason"
        error={error}
      >
        <div className="flex items-center gap-2">
          <Input
            size="lg"
            id="returns-custom-reason"
            value={draft}
            maxLength={CUSTOM_REASON_MAX_LENGTH}
            placeholder={copy.placeholder}
            disabled={full}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(undefined)
            }}
            onKeyDown={handleKeyDown}
          />
          <Button variant="outline" disabled={full || !draft.trim()} onClick={handleAdd}>
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        </div>
      </SettingsRow>
    </SettingsCard>
  )
}
