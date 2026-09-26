'use client'

import { CheckIcon, Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { paymentsSetupContent as copy } from '@/data/payments-setup'

type CopyFieldProps = {
  id: string
  value: string
}

/** A read-only value with a Copy button, for things the merchant pastes into a gateway. */
export default function CopyField({ id, value }: CopyFieldProps) {
  // Hooks
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the value is selectable in the box.
    }
  }

  return (
    <div className="flex gap-2">
      <Input id={id} size="lg" readOnly value={value} className="font-mono" />
      <Button type="button" variant="outline" size="lg" className="gap-1.5" onClick={handleCopy}>
        {copied ? (
          <CheckIcon aria-hidden="true" className="size-4" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
        {copied ? copy.connect.copied : copy.connect.copy}
      </Button>
    </div>
  )
}
