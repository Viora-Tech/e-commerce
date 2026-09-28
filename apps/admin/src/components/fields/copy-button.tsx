'use client'

import { CheckIcon, Copy } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import { copyButtonContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'

type CopyButtonProps = {
  value: string
  /** What is being copied, for the tooltip and the toast: "Email", "Phone". */
  what: string
}

/** Copies a value to the clipboard and says so for a moment. */
export default function CopyButton({ value, what }: CopyButtonProps) {
  // Hooks
  const copy = useCopy(copyButtonContent)
  const [done, setDone] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
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
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copy.copy(what.toLowerCase())}
      className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100"
    >
      <Icon className="size-3.5" />
    </button>
  )
}
