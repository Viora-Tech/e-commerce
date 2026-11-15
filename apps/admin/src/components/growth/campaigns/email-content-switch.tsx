'use client'

import type { EmailBlock, EmailDesign, EmailEditor } from '@commerce/core/marketing'
import { Blocks, Palette } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog } from '@commerce/ui/shadcn/dialog'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import DialogContent from '@/components/layout/dialog-content'
import { emailBuilderContent } from '@/data/email-builder'
import { useCopy } from '@/hooks/use-copy'
import EmailContentCard from './email-content-card'

type EmailContentSwitchProps = {
  editor: EmailEditor
  blocks: EmailBlock[]
  design: EmailDesign | null
  storefrontUrl: string
  onChange: (patch: { editor?: EmailEditor; blocks?: EmailBlock[]; design?: EmailDesign }) => void
}

/* GrapesJS is large; it loads only when the merchant opens the builder, inside its dialog. */
const VisualBuilder = dynamic(() => import('./visual-builder/visual-builder'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  ),
})

const MODES = [
  { value: 'blocks', icon: Blocks },
  { value: 'visual', icon: Palette },
] as const

/** Picks how this campaign's email is built: the block composer or the visual builder. */
export default function EmailContentSwitch({
  editor,
  blocks,
  design,
  storefrontUrl,
  onChange,
}: EmailContentSwitchProps) {
  // Hooks
  const { card: copy } = useCopy(emailBuilderContent)
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Event handlers
  const handleClose = () => {
    setOpen(false)
    setDirty(false)
  }

  const handleSave = (next: EmailDesign) => {
    onChange({ design: next, editor: 'visual' })
    handleClose()
  }

  // Render logic
  const labels = {
    blocks: { title: copy.blocks, hint: copy.blocksHint },
    visual: { title: copy.visual, hint: copy.visualHint },
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((m) => {
          const Icon = m.icon
          const active = editor === m.value
          return (
            <button
              key={m.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ editor: m.value })}
              className={cn(
                'motion-press flex items-start gap-3 rounded-lg border p-3 text-left',
                active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <span className="text-body-strong">{labels[m.value].title}</span>
                <span className="text-caption text-muted-foreground">{labels[m.value].hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      {editor === 'blocks' ? (
        <EmailContentCard blocks={blocks} onChange={(next) => onChange({ blocks: next })} />
      ) : (
        <DataCard title={copy.title} bodyClassName="flex flex-col items-start gap-3">
          <p className="text-body text-muted-foreground">{design ? copy.ready : copy.empty}</p>
          <Button onClick={() => setOpen(true)}>
            <Palette />
            {design ? copy.edit : copy.open}
          </Button>
          <p className="text-caption text-muted-foreground">{copy.switchNote}</p>
        </DataCard>
      )}
      {/* The shell's full size: Esc and X close it, and ask first once the canvas has changes. */}
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
        <DialogContent size="full" panel dirty={dirty}>
          {/* Mounted with the popup, so it keeps its canvas while the dialog animates out. */}
          <VisualBuilder
            design={design}
            storefrontUrl={storefrontUrl}
            onSave={handleSave}
            onClose={handleClose}
            onDirtyChange={setDirty}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
