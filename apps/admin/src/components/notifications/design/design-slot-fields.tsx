'use client'

import {
  DESIGN_LIMITS,
  SLOT_EDITS,
  type SlotBlock,
  type SlotEdit,
  type SlotEditKind,
  slotEditable,
  slotKind,
} from '@commerce/notifications/design'
import { Lock } from '@commerce/ui/icons'
import SwitchRow from '@/components/fields/switch-row'
import { emailDesignContent } from '@/data/email-design'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import DesignButtonStyleFields from './design-button-style-fields'
import DesignColourField from './design-colour-field'
import { isLocked } from './design-state'
import DesignTextField from './design-text-field'

type DesignSlotFieldsProps = {
  block: SlotBlock
  onChange: (edit: SlotEdit | undefined) => void
}

/** Built-in colours shown in the swatches until the merchant picks one. */
const FALLBACK: Record<string, string> = { ink: '#161615', bg: '#f5f1fe', line: '#eeede9' }

/** Drops empty parts; no edit at all when nothing is changed. */
function tidy(edit: SlotEdit): SlotEdit | undefined {
  const texts = Object.fromEntries(Object.entries(edit.texts ?? {}).filter(([, v]) => v))
  const colours = Object.fromEntries(Object.entries(edit.colours ?? {}).filter(([, v]) => v))
  const out: SlotEdit = {
    ...(Object.keys(texts).length > 0 ? { texts } : {}),
    ...(edit.hide && edit.hide.length > 0 ? { hide: edit.hide } : {}),
    ...(Object.keys(colours).length > 0 ? { colours } : {}),
    ...(edit.button ? { button: edit.button } : {}),
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * One of the order's own blocks: its words (empty keeps the built-in words), the parts that can
 * be switched off and its colours. The order's data still fills in on every send.
 */
export default function DesignSlotFields({ block, onChange }: DesignSlotFieldsProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const fields = useCopy(emailDesignFieldsContent)

  // Helpers
  const id = (f: string) => `design-${block.id}-${f}`

  // Event handlers
  const handleSet = (patch: SlotEdit) => onChange(tidy({ ...block.edit, ...patch }))

  // Early returns
  if (!slotEditable(slotKind(block.slot))) {
    return (
      <>
        <LockLine locked={isLocked(block)} copy={copy} />
        <p className="text-caption text-muted-foreground">{fields.slot.noEdits}</p>
      </>
    )
  }

  // Render logic
  const kind = slotKind(block.slot) as SlotEditKind
  const s = fields.slot
  const rules = SLOT_EDITS[kind]
  const hidden = new Set(block.edit?.hide ?? [])

  return (
    <>
      <LockLine locked={isLocked(block)} copy={copy} />
      {rules.texts.length > 0 ? (
        <p className="text-caption text-muted-foreground">{s.textsHint}</p>
      ) : null}
      {(rules.texts as readonly string[]).map((k) => (
        <DesignTextField
          key={k}
          id={id(k)}
          label={s.texts[k] ?? k}
          value={block.edit?.texts?.[k] ?? ''}
          placeholder={copy.fields.builtInPlaceholder}
          multiline={k === 'body' || k === 'text' || k === 'note'}
          maxLength={DESIGN_LIMITS.text}
          onChange={(v) => handleSet({ texts: { ...block.edit?.texts, [k]: v } })}
        />
      ))}
      {rules.hide.length > 0 ? (
        <fieldset className="flex flex-col gap-2 border-t border-border pt-3">
          <legend className="pb-2 text-caption font-semibold text-muted-foreground">
            {s.show}
          </legend>
          {(rules.hide as readonly string[]).map((part) => (
            <SwitchRow
              key={part}
              id={id(`show-${part}`)}
              label={s.parts[part] ?? part}
              weight="normal"
              checked={!hidden.has(part)}
              onChange={(on) =>
                handleSet({
                  hide: on ? [...hidden].filter((h) => h !== part) : [...hidden, part],
                })
              }
            />
          ))}
        </fieldset>
      ) : null}
      {(rules.colours as readonly string[]).map((c) => (
        <DesignColourField
          key={c}
          label={s.colours[c] ?? c}
          value={block.edit?.colours?.[c as 'ink' | 'bg' | 'line']}
          fallback={FALLBACK[c] ?? '#000000'}
          onChange={(hex) => handleSet({ colours: { ...block.edit?.colours, [c]: hex } })}
        />
      ))}
      {rules.button ? (
        <DesignButtonStyleFields
          id={id('button')}
          value={block.edit?.button}
          onChange={(button) => handleSet({ button })}
        />
      ) : null}
    </>
  )
}

/** Whether the block is locked (order data) or a plain built-in line that may go. */
function LockLine({ locked, copy }: { locked: boolean; copy: typeof emailDesignContent }) {
  return (
    <p className="flex items-start gap-2 text-body text-muted-foreground">
      {locked ? <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
      {locked ? copy.editor.lockedNote : copy.editor.builtInNote}
    </p>
  )
}
