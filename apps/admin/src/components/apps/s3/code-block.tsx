'use client'

import { CheckIcon, Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { copyButtonContent as copy } from '@/data/common'

type CodeBlockProps = {
  /** What is being copied, for the toast: "IAM policy", "CORS rule". */
  what: string
  code: string
}

/** A read-only JSON/text block with an always-visible copy button, for policy and CORS snippets. */
export default function CodeBlock({ what, code }: CodeBlockProps) {
  // Hooks
  const [done, setDone] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setDone(true)
      toast.success(copy.copied(what))
      setTimeout(() => setDone(false), 1500)
    } catch {
      toast.error(copy.copy(what.toLowerCase()))
    }
  }

  // Render logic
  const Icon = done ? CheckIcon : Copy

  return (
    <div className="relative">
      <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 pr-12 font-mono text-caption text-foreground">
        {code}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 gap-1.5"
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {done ? copy.copied(what) : copy.copy(what)}
      </Button>
    </div>
  )
}
