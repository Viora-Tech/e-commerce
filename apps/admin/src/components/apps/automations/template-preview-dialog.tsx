'use client'

import type { CatalogueView, WorkflowDefinition } from '@commerce/core/automations'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import {
  automationEditorContent,
  automationPiecesContent,
  automationsContent,
} from '@/data/automations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import WorkflowCanvas from './canvas/workflow-canvas'

type TemplatePreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  description: string
  definition: WorkflowDefinition | null
  catalogue: CatalogueView
  busy: boolean
  onUse: () => void
}

const noop = () => undefined

/** A template's workflow drawn read-only on the canvas, with Use template. */
export default function TemplatePreviewDialog({
  open,
  onOpenChange,
  name,
  description,
  definition,
  catalogue,
  busy,
  onUse,
}: TemplatePreviewDialogProps) {
  // Hooks
  const { templates: copy } = useCopy(automationsContent)
  const editor = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()

  // Render logic
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{copy.previewTitle(name)}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {definition ? (
          <WorkflowCanvas
            className="h-[28rem] rounded-lg border border-border"
            ctx={{
              def: definition,
              catalogue,
              pieces,
              locale,
              copy: editor,
              selected: null,
              flagged: new Set(),
              marks: null,
              readOnly: true,
              onSelect: noop,
              onInsert: noop,
            }}
          />
        ) : null}
        <DialogFooter>
          <Button disabled={busy} onClick={onUse}>
            {copy.use}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
