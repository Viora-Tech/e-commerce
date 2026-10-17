'use client'

import type { McpClientId } from '@commerce/core/api-access'
import { CheckIcon, Copy } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { useState } from 'react'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'
import { clientInstallUrl } from '@/lib/mcp'

type ConnectClientDialogProps = {
  client: McpClientId | null
  serverUrl: string
  storeName: string
  onClose: () => void
}

/** Figma "Connect Claude (guide)": copy the URL, add it in the tool, sign in. */
export default function ConnectClientDialog({
  client,
  serverUrl,
  storeName,
  onClose,
}: ConnectClientDialogProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    await navigator.clipboard.writeText(serverUrl)
    setCopied(true)
  }

  const handleOpenChange = (open: boolean) => {
    if (open) return
    setCopied(false)
    onClose()
  }

  // Early returns
  if (!client) return null

  // Render logic
  const c = copy.clients[client]
  const href = clientInstallUrl(client, serverUrl, storeName)
  const external = href.startsWith('https:')

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.guide.title(c.name)}</DialogTitle>
          <DialogDescription>{copy.guide.intro(c.name)}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-4">
          {c.steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-caption font-medium tabular-nums">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-body text-ink-strong">{step.title}</span>
                  {step.body ? (
                    <span className="text-caption text-muted-foreground">{step.body}</span>
                  ) : null}
                </div>
              </div>
              {i === 0 ? (
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                    copied
                      ? 'border-success/30 bg-success-soft'
                      : 'border-border bg-muted/40 hover:bg-muted',
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-caption text-muted-foreground">{copy.server.url}</span>
                    <span className="truncate font-mono text-body text-ink-strong">
                      {serverUrl}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-1 text-caption',
                      copied ? 'text-success' : 'text-muted-foreground',
                    )}
                  >
                    {copied ? <CheckIcon className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? copy.server.copied : copy.server.copy}
                  </span>
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="text-caption text-muted-foreground">{copy.guide.others}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {copy.guide.close}
          </Button>
          <Button
            nativeButton={false}
            render={
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              />
            }
          >
            {c.open}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
