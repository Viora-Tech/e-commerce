'use client'

import { CheckIcon as Check, Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { affiliatePortalContent as copy } from '@/data/affiliate-portal'

type CopyFieldProps = {
  value: string
  /** The field's accessible name. */
  label: string
  /** Larger, for the dashboard's main link. */
  size?: 'default' | 'lg'
}

/** A read-only value with a Copy button that says Copied for a moment. */
export default function CopyField({ value, label, size = 'default' }: CopyFieldProps) {
  // Hooks
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  // Render logic
  return (
    <div className="flex min-w-0 gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label}
        className={`min-w-0 flex-1 font-mono ${size === 'lg' ? 'h-10' : ''}`}
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        type="button"
        variant={size === 'lg' ? 'default' : 'outline'}
        size={size === 'lg' ? 'lg' : 'default'}
        onClick={handleCopy}
        aria-live="polite"
      >
        {copied ? <Check /> : <Copy />}
        {copied ? copy.dashboard.link.copied : copy.dashboard.link.copy}
      </Button>
    </div>
  )
}
