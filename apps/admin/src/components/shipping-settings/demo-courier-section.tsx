'use client'

import { ChevronDown, ChevronRight } from '@commerce/ui/icons'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Settings = Awaited<ReturnType<typeof api.store.getShipping>>['settings']

type DemoCourierSectionProps = {
  settings: Settings
  /** Unsaved edits on the page: save them first so this switch does not drop them. */
  dirty: boolean
  demoId: string
  onSaved: (next: Settings) => void
}

/** Advanced, development only: switch the pretend courier on or off. Saves straight away. */
export default function DemoCourierSection({
  settings,
  dirty,
  demoId,
  onSaved,
}: DemoCourierSectionProps) {
  // Hooks
  const setupCopy = useCopy(shippingSettingsContent)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleToggle = async (on: boolean) => {
    setSaving(true)
    try {
      const enabled = on
        ? [...new Set([...settings.enabled, demoId])]
        : settings.enabled.filter((id) => id !== demoId)
      const result = await api.store.updateShipping({ ...settings, enabled })
      onSaved(result ?? { ...settings, enabled })
      toast.success(setupCopy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : setupCopy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const copy = setupCopy.advanced
  const on = settings.enabled.includes(demoId)

  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 text-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown aria-hidden="true" className="hidden size-4 group-data-[panel-open]:block" />
        <ChevronRight aria-hidden="true" className="size-4 group-data-[panel-open]:hidden" />
        {copy.heading}
        <span className="font-normal text-muted-foreground">· {copy.help}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-3">
          <CardContent className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-0.5">
              <label htmlFor="shipping-demo-courier" className="text-body font-medium">
                {copy.demo}
              </label>
              <p className="text-caption text-muted-foreground">
                {dirty ? copy.saveFirst : copy.demoHelp}
              </p>
            </div>
            <Switch
              id="shipping-demo-courier"
              checked={on}
              disabled={saving || dirty}
              onCheckedChange={handleToggle}
            />
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}
