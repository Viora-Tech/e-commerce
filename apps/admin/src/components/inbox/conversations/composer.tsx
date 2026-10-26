'use client'

import { BadgePercent, ImagePlus, Lock, Package, Send } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { Toggle } from '@commerce/ui/shadcn/toggle'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'
import { matchQuickReplies } from '@/lib/inbox-view'
import { uploadFile } from '@/lib/upload'
import DiscountShareDialog from './discount-share-dialog'
import ProductShareDialog from './product-share-dialog'

export type ComposerSend =
  | { kind: 'text' | 'note'; body: string }
  | { kind: 'product'; productIds: string[] }
  | { kind: 'discount'; discountId: string }
  | { kind: 'image'; mediaId: string }

type ComposerProps = {
  disabled: boolean
  /** Why the composer is off (a blocked conversation). */
  disabledReason?: string | undefined
  quickReplies: { id: string; shortcut: string; title: string; body: string }[]
  canShareProducts: boolean
  canShareDiscounts: boolean
  onSend: (message: ComposerSend) => Promise<void>
  /** "Typing…" to the shopper; the caller throttles it. */
  onTyping: () => void
  /** A draft to put in the box (a suggested reply), numbered so picking the same one twice still lands. */
  seed?: { seq: number; text: string } | null | undefined
}

/**
 * The reply box: text with `/` quick replies, a Note switch (staff only), and buttons to share
 * products, a discount code or an image. Enter sends, Shift+Enter adds a line.
 */
export default function Composer({
  disabled,
  disabledReason,
  quickReplies,
  canShareProducts,
  canShareDiscounts,
  onSend,
  onTyping,
  seed,
}: ComposerProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState<'product' | 'discount' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!seed) return
    setNote(false)
    setDraft(seed.text)
    textRef.current?.focus()
  }, [seed])

  // Helpers
  const send = async (message: ComposerSend) => {
    setBusy(true)
    try {
      await onSend(message)
      return true
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      return false
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleSubmit = async () => {
    const body = draft.trim()
    if (!body || busy) return
    if (await send({ kind: note ? 'note' : 'text', body })) setDraft('')
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }
  const handleChange = (value: string) => {
    setDraft(value)
    if (!note && value.trim()) onTyping()
  }
  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const uploaded = await uploadFile(file)
      await onSend({ kind: 'image', mediaId: uploaded.id })
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Render logic
  const c = copy.composer
  const matches = matchQuickReplies(quickReplies, draft)

  return (
    <div className="relative border-t border-hairline p-3">
      {matches ? (
        <div className="absolute right-3 bottom-full left-3 mb-2 max-h-60 overflow-y-auto rounded-xl surface-card p-1 shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-caption text-muted-foreground">{c.noQuickReplies}</p>
          ) : (
            <ul>
              {matches.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent"
                    onClick={() => setDraft(r.body)}
                  >
                    <span className="text-body-strong">
                      <code className="font-mono">/{r.shortcut}</code> · {r.title}
                    </span>
                    <span className="line-clamp-1 text-caption text-muted-foreground">
                      {r.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {disabled && disabledReason ? (
        <p className="mb-2 text-caption text-muted-foreground">{disabledReason}</p>
      ) : null}
      <div
        className={cn(
          'flex flex-col gap-2 rounded-xl border border-input bg-background p-2',
          note && 'border-dashed bg-muted/40',
        )}
      >
        <Textarea
          ref={textRef}
          value={draft}
          rows={2}
          maxLength={2000}
          disabled={disabled && !note}
          placeholder={note ? c.notePlaceholder : c.placeholder}
          aria-label={note ? c.notePlaceholder : c.placeholder}
          className="min-h-12 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Toggle size="sm" pressed={note} onPressedChange={setNote} aria-label={c.note}>
              <Lock aria-hidden="true" />
              {c.note}
            </Toggle>
            {canShareProducts ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={c.product}
                disabled={disabled || busy}
                onClick={() => setPicking('product')}
              >
                <Package className="size-4" />
              </Button>
            ) : null}
            {canShareDiscounts ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={c.discount}
                disabled={disabled || busy}
                onClick={() => setPicking('discount')}
              >
                <BadgePercent className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={c.image}
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" />
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          <Button
            size="sm"
            loading={busy}
            disabled={!draft.trim() || (disabled && !note)}
            onClick={handleSubmit}
          >
            <Send aria-hidden="true" />
            {note ? c.addNote : c.send}
          </Button>
        </div>
      </div>
      {picking === 'product' ? (
        <ProductShareDialog
          onClose={() => setPicking(null)}
          onShare={async (productIds) => {
            if (await send({ kind: 'product', productIds })) setPicking(null)
          }}
        />
      ) : null}
      {picking === 'discount' ? (
        <DiscountShareDialog
          onClose={() => setPicking(null)}
          onShare={async (discountId) => {
            if (await send({ kind: 'discount', discountId })) setPicking(null)
          }}
        />
      ) : null}
    </div>
  )
}
