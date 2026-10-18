'use client'

import { siteConfig } from '@commerce/config/site'
import { CheckIcon, Copy_ as Copy } from '@commerce/ui/icons'
import { useState } from 'react'
import { waitlistContent as copy } from '@/data/waitlist'

// TODO(owner): per-person referral links. Until the public waitlist endpoint exists this is the
// bare site link, shown as a placeholder.
const SHARE_URL = `${siteConfig.brand.domain}/`
const COPIED_MS = 2000

export default function ShareLinkField() {
  // Hooks
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${SHARE_URL}`)
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_MS)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-input-surface px-3 py-2">
      <div className="min-w-0 text-xs">
        <p className="text-muted-foreground">{copy.success.shareLabel}</p>
        <p className="truncate text-sm text-foreground">{SHARE_URL}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? copy.success.copied : copy.success.copy}
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {copied ? <CheckIcon className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}
