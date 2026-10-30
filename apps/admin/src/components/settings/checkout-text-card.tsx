'use client'

import type { CheckoutText } from '@commerce/core/checkout-settings'
import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { checkoutRulesContent } from '@/data/checkout-rules'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'
import CheckoutTextDialog from './checkout-text-dialog'

type CheckoutTextCardProps = {
  text: CheckoutText
  onChange: (text: CheckoutText) => void
}

/** How many strings a language rewords (blank boxes keep ours, so they do not count). */
export const editedCount = (overrides: Partial<Record<string, string>>): number =>
  Object.values(overrides).filter((v) => (v ?? '').trim().length > 0).length

/**
 * Settings → Checkout → Checkout content (#158): how many strings the store rewords in each
 * language, and "Edit checkout content", which opens the editor in a dialog.
 */
export default function CheckoutTextCard({ text, onChange }: CheckoutTextCardProps) {
  // Hooks
  const { content: copy, rows } = useCopy(checkoutRulesContent)
  const [open, setOpen] = useState(false)
  // A fresh dialog (and draft) each time it opens.
  const [opened, setOpened] = useState(0)

  // Event handlers
  const handleOpen = () => {
    setOpened((n) => n + 1)
    setOpen(true)
  }

  // Render logic
  const summary = (['en', 'hi'] as const).map((lang) => {
    const n = editedCount(text[lang])
    return {
      lang,
      label: copy.languages[lang],
      value: n > 0 ? rows.contentEdited(n) : rows.contentDefault,
    }
  })

  return (
    <SettingsCard
      title={copy.heading}
      description={copy.description}
      footer={
        <Button variant="outline" onClick={handleOpen}>
          <Pencil aria-hidden="true" />
          {copy.edit}
        </Button>
      }
    >
      <ul className="flex flex-col divide-y divide-hairline">
        {summary.map((s) => (
          <li key={s.lang} className="flex items-center justify-between gap-4 py-2.5 text-body">
            <span className="font-medium">{s.label}</span>
            <span className="text-muted-foreground">{s.value}</span>
          </li>
        ))}
      </ul>
      <CheckoutTextDialog
        key={opened}
        open={open}
        text={text}
        onOpenChange={setOpen}
        onDone={onChange}
      />
    </SettingsCard>
  )
}
