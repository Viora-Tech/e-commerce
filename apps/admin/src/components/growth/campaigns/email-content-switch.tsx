'use client'

import type { EmailBlock, EmailDesign, EmailEditor } from '@commerce/core/marketing'
import { Blocks, Loader2Icon, Palette } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import dynamic from 'next/dynamic'
import { useState } from 'react'
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

/* GrapesJS is large; it loads only when the merchant opens the builder. */
const VisualBuilder = dynamic(() => import('./visual-builder/visual-builder'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
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

  // Event handlers
  const handleSave = (next: EmailDesign) => {
    onChange({ design: next, editor: 'visual' })
    setOpen(false)
  }

  // Render logic
  const labels = {
    blocks: { title: copy.blocks, hint: copy.blocksHint },
    visual: { title: copy.visual, hint: copy.visualHint },
  }

  return (
    <div className="flex flex-col gap-5">
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
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-body text-muted-foreground">{design ? copy.ready : copy.empty}</p>
            <Button onClick={() => setOpen(true)}>
              <Palette />
              {design ? copy.edit : copy.open}
            </Button>
            <p className="text-caption text-muted-foreground">{copy.switchNote}</p>
          </CardContent>
        </Card>
      )}
      {open ? (
        <VisualBuilder
          design={design}
          storefrontUrl={storefrontUrl}
          onSave={handleSave}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}
