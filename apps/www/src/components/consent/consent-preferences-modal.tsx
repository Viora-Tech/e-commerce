'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { consentContent as copy } from '@/data/consent'
import { ACCEPT_ALL, type ConsentChoice, ESSENTIAL_ONLY } from '@/lib/consent'

type ConsentPreferencesModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: ConsentChoice
  onSave: (choice: ConsentChoice) => void
}

export default function ConsentPreferencesModal({
  open,
  onOpenChange,
  current,
  onSave,
}: ConsentPreferencesModalProps) {
  // Hooks
  const [draft, setDraft] = useState<ConsentChoice>(current)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(current)
    onOpenChange(next)
  }
  const setCategory = (key: 'analytics' | 'marketing', value: boolean) =>
    setDraft((previous) => ({ ...previous, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="gap-0 p-0 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none md:max-w-lg"
      >
        <div className="p-5 pb-3">
          <DialogTitle className="text-lg font-semibold text-foreground">
            {copy.modalTitle}
          </DialogTitle>
          <DialogDescription className="mt-1 text-muted-foreground">
            {copy.modalIntro}
          </DialogDescription>
        </div>
        <ul className="flex flex-col">
          {copy.categories.map((category) => (
            <li
              key={category.key}
              className="flex items-start justify-between gap-4 border-t border-border px-5 py-4"
            >
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {category.title}
                  {category.key === 'necessary' ? (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {copy.alwaysOn}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{category.body}</p>
              </div>
              {category.key === 'necessary' ? (
                <Switch checked disabled aria-label={category.title} />
              ) : (
                <Switch
                  checked={draft[category.key]}
                  onCheckedChange={(value) => setCategory(category.key, value)}
                  aria-label={category.title}
                />
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 border-t border-border p-5 sm:flex-row sm:items-center">
          <Button variant="outline" size="lg" onClick={() => onSave(ESSENTIAL_ONLY)}>
            {copy.rejectNonEssential}
          </Button>
          <Button variant="outline" size="lg" onClick={() => onSave(ACCEPT_ALL)}>
            {copy.acceptAll}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="sm:ml-auto"
            onClick={() => onSave(draft)}
          >
            {copy.saveChoices}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
