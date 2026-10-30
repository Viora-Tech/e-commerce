'use client'

import type { ThemeEditChange } from '@commerce/ai/client'
import { CircleCheck, FileEdit, TriangleAlert } from '@commerce/ui/icons'
import { type Data, useGetPuck } from '@puckeditor/core'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import { customizeAiContent } from '@/data/customize-ai'
import type { ThemeEditCard as ThemeEditCardView } from '@/hooks/use-assistant'
import { useCopy } from '@/hooks/use-copy'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import { applyThemeEdits } from '@/lib/theme-edit-apply'

type ThemeEditCardProps = {
  edit: ThemeEditCardView
  /** The theme open in the editor is the store's live theme. */
  live: boolean
  onStatus: (id: string, status: ThemeEditCardView['status']) => void
}

type CardCopy = (typeof customizeAiContent)['card']

/** A value as the card shows it: On/Off for a checkbox, "(empty)" for nothing. */
function shown(value: ThemeEditChange['before'], copy: CardCopy): string {
  if (typeof value === 'boolean') return value ? copy.on : copy.off
  if (value === null || value === '') return copy.empty
  return String(value)
}

/**
 * A page edit the editor's AI chat drafted: what it does and each setting's old and new value,
 * with Apply and Dismiss. Apply changes the open page through Puck (one Undo step, saved as a
 * draft like any edit); nothing reaches shoppers until the merchant saves the live theme or
 * publishes this one, and the card says which.
 */
export default function ThemeEditCard({ edit, live, onStatus }: ThemeEditCardProps) {
  // Hooks
  const copy = useCopy(customizeAiContent.card)
  const getPuck = useGetPuck()
  const dispatch = useCustomizePuck((s) => s.dispatch)

  // Event handlers
  const handleApply = () => {
    const current = getPuck().appState.data as unknown as CustomizeDoc
    const check = applyThemeEdits(current, edit.changes)
    if (check.applied === 0) {
      toast.error(copy.gone)
      return
    }
    // One history entry for the whole edit, so Undo takes it all back; Puck's onChange then
    // schedules the draft save like a typed edit.
    dispatch({
      type: 'setData',
      data: (prev) =>
        applyThemeEdits(prev as unknown as CustomizeDoc, edit.changes).doc as unknown as Data,
      recordHistory: true,
    })
    if (check.missing.length) toast.warning(copy.partly(check.missing.length))
    onStatus(edit.id, 'applied')
  }

  // Render logic
  const open = edit.status === 'proposed'

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs ${open ? 'border-border-strong' : 'border-border'} ${edit.status === 'dismissed' ? 'opacity-70' : ''}`}
    >
      <header className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileEdit className="size-4 text-ink-strong" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-caption text-muted-foreground">{copy.title}</span>
          <h3 className="text-body font-semibold break-words text-ink-strong">{edit.summary}</h3>
        </div>
      </header>

      {edit.flagged && open ? (
        <p className="mx-4 mb-3 flex gap-2 rounded-lg bg-warning/15 px-3 py-2 text-caption text-warning-foreground dark:text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {copy.flagged}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2.5 px-4 pb-3.5">
        {edit.changes.map((change) => (
          <li
            key={`${change.sectionId}/${change.blockId ?? ''}/${change.setting}`}
            className="flex min-w-0 flex-col gap-0.5 text-caption"
          >
            <span className="font-medium break-words text-ink-strong">
              {copy.where(change.sectionLabel, change.blockLabel)} · {change.settingLabel}
            </span>
            {change.kind === 'image' ? (
              // A picture reads as a picture, not its address: old one faded, new one beside it.
              <span className="flex items-center gap-2">
                {typeof change.before === 'string' && change.before ? (
                  <img
                    src={change.before}
                    alt=""
                    className="size-12 shrink-0 rounded-md object-cover opacity-50"
                  />
                ) : (
                  <span className="text-muted-foreground line-through">{copy.empty}</span>
                )}
                <span aria-hidden="true" className="text-muted-foreground">
                  →
                </span>
                {typeof change.value === 'string' && change.value ? (
                  <img
                    src={change.value}
                    alt=""
                    className="size-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="text-ink-strong">{copy.empty}</span>
                )}
              </span>
            ) : (
              <>
                <span className="line-clamp-3 break-words text-muted-foreground line-through">
                  {shown(change.before, copy)}
                </span>
                <span className="line-clamp-4 break-words whitespace-pre-wrap text-ink-strong">
                  {shown(change.value, copy)}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      {open ? (
        <footer className="flex flex-col gap-2 border-border border-t bg-muted/30 px-4 py-2.5">
          <p className="text-caption text-muted-foreground">
            {live ? copy.liveNote : copy.draftNote}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <KitButton variant="primary" onClick={handleApply}>
              {copy.apply}
            </KitButton>
            <KitButton
              variant="link"
              onClick={() => onStatus(edit.id, 'dismissed')}
              className="ml-auto"
            >
              {copy.dismiss}
            </KitButton>
          </div>
        </footer>
      ) : null}

      {edit.status === 'applied' ? (
        <footer className="flex flex-col gap-0.5 border-border border-t bg-muted/30 px-4 py-2.5 text-caption">
          <span className="flex items-center gap-1.5 font-medium text-ink-strong">
            <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
            {live ? copy.appliedLive : copy.applied}
          </span>
          <span className="text-muted-foreground">{copy.undo}</span>
        </footer>
      ) : null}

      {edit.status === 'dismissed' ? (
        <footer className="border-border border-t bg-muted/30 px-4 py-2.5 text-caption text-muted-foreground">
          {copy.dismissed}
        </footer>
      ) : null}
    </article>
  )
}
