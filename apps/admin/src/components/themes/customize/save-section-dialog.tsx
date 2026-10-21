'use client'

import { CUSTOM_SECTION_LIMITS, type TemplateSection } from '@commerce/core/theme'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { saveMySection } from '@/lib/customize-my-sections'
import { useEditingThemeId } from '@/lib/customize-theme-context'
import SectionIcon from './section-icon'

type SaveSectionDialogProps = {
  /** The section or nested block to keep a copy of. */
  block: TemplateSection
  defaultName: string
  onClose: () => void
}

const copy = customizeContent.saveSection

/** "Save as my section": names a copy of the block and keeps it in the store's library. */
export default function SaveSectionDialog({ block, defaultName, onClose }: SaveSectionDialogProps) {
  // Hooks
  const themeId = useEditingThemeId()
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const saved = await saveMySection(themeId, name, block)
      toast.success(copy.saved(saved.name))
      onClose()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[26rem]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <SectionIcon type={block.type} tile="md" />
              <DialogTitle className="text-[0.9375rem] font-semibold tracking-tight">
                {copy.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">{copy.description}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="my-section-name">{copy.name}</FieldLabel>
            <Input
              id="my-section-name"
              value={name}
              maxLength={CUSTOM_SECTION_LIMITS.name}
              onChange={(e) => setName(e.target.value)}
              placeholder={copy.namePlaceholder}
              autoComplete="off"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy ? <Spinner /> : null}
              {busy ? copy.saving : copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
