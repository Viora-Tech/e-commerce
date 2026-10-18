'use client'

import {
  type AutomationSettings,
  type AutomationTrigger,
  STOPS_ON_ORDER,
} from '@commerce/core/marketing'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import DataCard from '@/components/layout/data-card'
import { automationEditorContent, automationsContent } from '@/data/marketing-automations'

type AutomationTriggerCardProps = {
  trigger: AutomationTrigger
  settings: AutomationSettings
  onChange: (settings: AutomationSettings) => void
}

const copy = automationEditorContent.trigger
const CART_TRIGGERS: AutomationTrigger[] = ['checkout_abandoned', 'cart_abandoned']

/** What starts the automation, its timing and who it may reach. */
export default function AutomationTriggerCard({
  trigger,
  settings,
  onChange,
}: AutomationTriggerCardProps) {
  // Render logic
  const minutes = settings.afterMinutes ?? 60

  return (
    <DataCard title={copy.title}>
      <FieldGroup>
        <p className="text-body">{automationsContent.triggers[trigger]}</p>
        {CART_TRIGGERS.includes(trigger) ? (
          <Field className="max-w-72">
            <FieldLabel htmlFor="after-minutes">{copy.afterMinutes}</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="after-minutes"
                type="number"
                min={15}
                step={15}
                value={minutes}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    afterMinutes: Math.max(15, Number(e.target.value) || 15),
                  })
                }
              />
              <span className="text-body text-muted-foreground">{copy.minutes}</span>
            </div>
          </Field>
        ) : null}
        {trigger === 'customer_lapsed' ? (
          <Field className="max-w-72">
            <FieldLabel htmlFor="lapsed-days">{copy.lapsedDays}</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="lapsed-days"
                type="number"
                min={7}
                value={settings.lapsedDays ?? 90}
                onChange={(e) =>
                  onChange({ ...settings, lapsedDays: Math.max(7, Number(e.target.value) || 90) })
                }
              />
              <span className="text-body text-muted-foreground">{copy.days}</span>
            </div>
          </Field>
        ) : null}
        <Field>
          <FieldLabel>{copy.audience}</FieldLabel>
          <FieldDescription>
            {trigger === 'cod_order_placed' ? copy.audienceOrderUpdate : copy.audienceConsent}
          </FieldDescription>
        </Field>
        {STOPS_ON_ORDER[trigger] ? <FieldDescription>{copy.stops}</FieldDescription> : null}
      </FieldGroup>
    </DataCard>
  )
}
