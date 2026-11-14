'use client'

import {
  CHECKOUT_TEXT_KEYS,
  CHECKOUT_TEXT_MAX,
  type CheckoutText,
  type CheckoutTextKey,
  type CheckoutTextLanguage,
} from '@commerce/core/checkout-settings'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import PillTabs from '@/components/layout/pill-tabs'
import { checkoutRulesContent } from '@/data/checkout-rules'
import { useCopy } from '@/hooks/use-copy'

type CheckoutTextDialogProps = {
  open: boolean
  text: CheckoutText
  onOpenChange: (open: boolean) => void
  onDone: (text: CheckoutText) => void
}

type Group = 'sections' | 'contact' | 'delivery' | 'payment'

/** Where each editable string sits on the checkout, for the dialog's headings. */
const groupOf = (key: CheckoutTextKey): Group => {
  if (key.startsWith('sections.') || key === 'express.heading') return 'sections'
  if (key === 'fields.phone' || key === 'fields.phoneHint' || key.startsWith('fields.email')) {
    return 'contact'
  }
  if (key.startsWith('fields.') && !key.startsWith('fields.note')) return 'delivery'
  return 'payment'
}

const GROUPS: readonly Group[] = ['sections', 'contact', 'delivery', 'payment']

/**
 * "Edit checkout content" (#158): one box per string the merchant may reword, per language,
 * our English wording as each placeholder. Done hands the draft back; the page's Save stores it.
 */
export default function CheckoutTextDialog({
  open,
  text,
  onOpenChange,
  onDone,
}: CheckoutTextDialogProps) {
  // Hooks
  const { content: copy } = useCopy(checkoutRulesContent)
  const [lang, setLang] = useState<CheckoutTextLanguage>('en')
  const [draft, setDraft] = useState<CheckoutText>(text)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(text)
    onOpenChange(next)
  }
  const handleField = (key: CheckoutTextKey, value: string) =>
    setDraft((d) => ({ ...d, [lang]: { ...d[lang], [key]: value } }))
  const handleReset = () => setDraft((d) => ({ ...d, [lang]: {} }))
  const handleDone = () => {
    onDone(draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{copy.dialogTitle}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <PillTabs
          variant="segmented"
          className="self-start"
          value={lang}
          onChange={setLang}
          tabs={[
            { value: 'en' as const, label: copy.languages.en },
            { value: 'hi' as const, label: copy.languages.hi },
          ]}
        />
        <div className="flex max-h-[55vh] flex-col gap-5 overflow-y-auto pr-1">
          {GROUPS.map((group) => (
            <section key={group} className="flex flex-col gap-3">
              <h3 className="text-eyebrow">{copy.groups[group]}</h3>
              {CHECKOUT_TEXT_KEYS.filter((k) => groupOf(k) === group).map((key) => (
                <div
                  key={key}
                  className="grid gap-1.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] md:items-center md:gap-4"
                >
                  <FieldLabel htmlFor={`checkout-text-${key}`}>{copy.keys[key]}</FieldLabel>
                  <Input
                    id={`checkout-text-${key}`}
                    maxLength={CHECKOUT_TEXT_MAX}
                    placeholder={
                      lang === 'hi' && draft.en[key] ? draft.en[key] : copy.defaults[key]
                    }
                    value={draft[lang][key] ?? ''}
                    onChange={(e) => handleField(key, e.target.value)}
                  />
                </div>
              ))}
            </section>
          ))}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={handleReset}>
            {copy.reset}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button onClick={handleDone}>{copy.done}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
