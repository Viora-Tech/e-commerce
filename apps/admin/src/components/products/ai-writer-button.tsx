'use client'

import { AiIcon } from '@commerce/ui/icons'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import { aiContent } from '@/data/ai'
import { useCopy } from '@/hooks/use-copy'
import { useOpenedOnce } from '@/hooks/use-opened-once'
import type { CopyPatch } from '@/lib/ai-product-copy'
import type { ProductFormState } from './form-state'

type AiWriterButtonProps = {
  form: ProductFormState
  onApply: (patch: CopyPatch) => void
}

/* The writer dialog (options, preview, diff) loads when the chip is first pressed. */
const AiWriterDialog = dynamic(() => import('./ai-writer-dialog'), { ssr: false })

/** The "Write with AI" chip on the product details card, and the dialog it opens. */
export default function AiWriterButton({ form, onApply }: AiWriterButtonProps) {
  // Hooks
  const copy = useCopy(aiContent)
  const [open, setOpen] = useState(false)
  const used = useOpenedOnce(open)

  // Render logic
  return (
    <>
      <KitButton variant="chip" onClick={() => setOpen(true)}>
        <AiIcon className="text-primary" aria-hidden="true" />
        {copy.writer.button}
      </KitButton>
      {used ? (
        <AiWriterDialog open={open} onOpenChange={setOpen} form={form} onApply={onApply} />
      ) : null}
    </>
  )
}
