'use client'

import { CheckIcon, Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { copyButtonContent } from '@/data/common'
import { useClipboard } from '@/hooks/use-clipboard'
import { useCopy } from '@/hooks/use-copy'

type CopyFieldProps = {
  id: string
  value: string
}

/**
 * A read-only value with a Copy button, for things the merchant pastes elsewhere (a gateway's
 * webhook address, a login app's redirect address). Blocked clipboard: the value stays selectable.
 */
export default function CopyField({ id, value }: CopyFieldProps) {
  // Hooks
  const copy = useCopy(copyButtonContent)
  const { done, copyText } = useClipboard(2000)

  // Render logic
  const Icon = done ? CheckIcon : Copy

  return (
    <div className="flex gap-2">
      <Input id={id} size="lg" readOnly value={value} className="font-mono" />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="gap-1.5"
        onClick={() => void copyText(value)}
      >
        <Icon aria-hidden="true" className="size-4" />
        {done ? copy.buttonDone : copy.button}
      </Button>
    </div>
  )
}
