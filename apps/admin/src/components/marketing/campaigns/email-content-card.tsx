'use client'

import {
  EMAIL_BLOCK_TYPES,
  type EmailBlock,
  type EmailBlockType,
  newEmailBlock,
} from '@commerce/core/marketing'
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { useState } from 'react'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import EmailBlockFields from './email-block-fields'
import { blockId, moveBlock } from './form-state'

type EmailContentCardProps = {
  blocks: EmailBlock[]
  onChange: (blocks: EmailBlock[]) => void
  /** Cart contents only make sense in cart and checkout automations. */
  allowCart?: boolean | undefined
  /** Drop the card frame when nested in another card. */
  bare?: boolean | undefined
}

const copy = campaignEditorContent
/* Inside an automation step the list sits in the step's own card, so it drops its frame. */
const BARE_CARD = 'gap-3 rounded-none border-0 bg-transparent py-0 shadow-none ring-0'

/** One line summary so a collapsed block still says what it holds. */
function summary(block: EmailBlock): string {
  switch (block.type) {
    case 'text':
      return block.heading || block.text.split('\n')[0] || ''
    case 'button':
      return block.label
    case 'image':
      return block.alt || block.url
    case 'products':
      return block.items.map((i) => i.title).join(', ')
    case 'discount':
      return block.code
    default:
      return ''
  }
}

/** The block list: add, edit in place, reorder and remove. */
export default function EmailContentCard({
  blocks,
  onChange,
  allowCart,
  bare,
}: EmailContentCardProps) {
  // Hooks
  const [open, setOpen] = useState<string | null>(blocks[1]?.id ?? blocks[0]?.id ?? null)

  // Event handlers
  const handleAdd = (type: EmailBlockType) => {
    const block = newEmailBlock(type, blockId())
    onChange([...blocks, block])
    setOpen(block.id)
  }

  const handleChange = (next: EmailBlock) =>
    onChange(blocks.map((b) => (b.id === next.id ? next : b)))

  const handleRemove = (id: string) => onChange(blocks.filter((b) => b.id !== id))

  // Render logic
  const types = EMAIL_BLOCK_TYPES.filter((t) => allowCart || t !== 'cart')

  return (
    <Card className={bare ? BARE_CARD : undefined}>
      <CardHeader className={cn('flex flex-row items-center justify-between', bare && 'px-0')}>
        <CardTitle>{copy.content.title}</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Plus />
            {copy.content.add}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {types.map((t) => (
              <DropdownMenuItem
                key={t}
                onClick={() => handleAdd(t)}
                className="flex-col items-start gap-0"
              >
                <span className="font-medium">{copy.blocks[t]}</span>
                <span className="text-caption text-muted-foreground">{copy.blockHints[t]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className={cn('flex flex-col gap-2', bare && 'px-0')}>
        {blocks.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.content.empty}</p>
        ) : null}
        {blocks.map((block, i) => {
          const expanded = open === block.id
          return (
            <div key={block.id} className="rounded-lg border border-border">
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : block.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
                  aria-expanded={expanded}
                >
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      !expanded && '-rotate-90',
                    )}
                  />
                  <span className="shrink-0 text-body-strong">{copy.blocks[block.type]}</span>
                  <span className="truncate text-caption text-muted-foreground">
                    {summary(block)}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={copy.content.moveUp}
                  disabled={i === 0}
                  onClick={() => onChange(moveBlock(blocks, i, -1))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={copy.content.moveDown}
                  disabled={i === blocks.length - 1}
                  onClick={() => onChange(moveBlock(blocks, i, 1))}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={copy.content.remove}
                  onClick={() => handleRemove(block.id)}
                >
                  <Trash2 />
                </Button>
              </div>
              {expanded && block.type !== 'divider' ? (
                <div className="border-t border-border p-3">
                  <EmailBlockFields block={block} onChange={handleChange} />
                </div>
              ) : null}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
