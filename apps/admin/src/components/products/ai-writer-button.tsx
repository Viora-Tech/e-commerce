'use client'

import { AiIcon } from '@commerce/ui/icons'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import { aiContent } from '@/data/ai'
import { useCopy } from '@/hooks/use-copy'
import type { CopyPatch } from '@/lib/ai-product-copy'
import AiWriterSheet from './ai-writer-sheet'
import type { ProductFormState } from './form-state'

type AiWriterButtonProps = {
  form: ProductFormState
  onApply: (patch: CopyPatch) => void
}

/** The "Write with AI" chip on the product details card, and the sheet it opens. */
export default function AiWriterButton({ form, onApply }: AiWriterButtonProps) {
  // Hooks
  const copy = useCopy(aiContent)
  const [open, setOpen] = useState(false)

  // Render logic
  return (
    <>
      <KitButton variant="chip" onClick={() => setOpen(true)}>
        <AiIcon className="text-primary" aria-hidden="true" />
        {copy.writer.button}
      </KitButton>
      <AiWriterSheet open={open} onOpenChange={setOpen} form={form} onApply={onApply} />
    </>
  )
}
