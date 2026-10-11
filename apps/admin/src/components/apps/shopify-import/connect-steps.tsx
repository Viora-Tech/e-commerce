'use client'

import { CircleCheck, Copy, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { SCOPE_CSV, SCOPES, shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'

/** How long the copy button reads "copied" before it goes back. */
const COPIED_MS = 1800

/** The numbered steps for making a Dev Dashboard app: links open Shopify, scopes copy in one go. */
export default function ConnectSteps() {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SCOPE_CSV)
    } catch {
      return
    }
    setCopied(true)
    toast.success(copy.app.scopesCopied)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <ol className="flex flex-col">
      {copy.app.steps.map((step, i) => (
        <li key={step.text} className="relative flex gap-3 pb-6 last:pb-0">
          {i < copy.app.steps.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute top-7 bottom-1 left-3 w-px -translate-x-1/2 bg-border"
            />
          ) : null}
          <span
            aria-hidden="true"
            className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground tabular-nums"
          >
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-0.5">
            <p className="text-body text-foreground">{step.text}</p>
            {step.link ? (
              <a
                href={step.link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1 text-body-strong text-primary underline-offset-4 hover:underline"
              >
                {step.link.label}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
            {step.scopes ? (
              <div className="flex flex-col gap-2.5">
                <ul aria-label={copy.app.scopesLabel} className="flex flex-wrap gap-1.5">
                  {SCOPES.map((scope) => (
                    <li key={scope}>
                      <code className="rounded-md border border-hairline bg-muted px-1.5 py-0.5 font-mono text-caption text-foreground">
                        {scope}
                      </code>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={handleCopy}
                >
                  {copied ? <CircleCheck aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copy.app.copyScopes}
                </Button>
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
