'use client'

import { useState } from 'react'
import { affiliateContent } from '@/data/affiliate'

type CopyValueProps = { label: string; value: string; hint?: string | undefined }

const copy = affiliateContent.dashboard

/** A read-only value (the referral link, the code) with a copy button. */
export default function CopyValue({ label, value, hint }: CopyValueProps) {
  // Hooks
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the value is selectable in the field.
    }
  }

  // Render logic
  return (
    <div className="field">
      <span className="field__label text-small">{label}</span>
      <div className="flex gap-2">
        <input
          className="field__input min-w-0 flex-1"
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="btn btn--secondary" onClick={handleCopy}>
          <span className="btn__label">{copied ? copy.copied : copy.copy}</span>
        </button>
      </div>
      {hint ? <span className="text-small text-muted">{hint}</span> : null}
    </div>
  )
}
