'use client'

import {
  type AutomationSettings,
  type AutomationTrigger,
  STOPS_ON_ORDER,
} from '@commerce/core/marketing'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { automationEditorContent, automationsContent } from '@/data/marketing-automations'

type AutomationTriggerCardProps = {
  trigger: AutomationTrigger
  settings: AutomationSettings
  onChange: (settings: AutomationSettings) => void
}

const copy = automationEditorContent.trigger
const CART_TRIGGERS: AutomationTrigger[] = ['checkout_abandoned', 'cart_abandoned']
const AUDIENCE_OPTIONS = [
  { value: 'subscribed', label: copy.audienceSubscribed },
  { value: 'all', label: copy.audienceAll },
]

/** What starts the automation, its timing and who it may reach. */
export default function AutomationTriggerCard({
  trigger,
  settings,
  onChange,
}: AutomationTriggerCardProps) {
  // Render logic
  const minutes = settings.afterMinutes ?? 60

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent>
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
          <ChoiceField
            id="audience"
            label={copy.audience}
            value={settings.audience ?? 'subscribed'}
            options={AUDIENCE_OPTIONS}
            help={copy.audienceHelp}
            onChange={(audience) =>
              onChange({ ...settings, audience: audience as 'subscribed' | 'all' })
            }
          />
          {STOPS_ON_ORDER[trigger] ? <FieldDescription>{copy.stops}</FieldDescription> : null}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
