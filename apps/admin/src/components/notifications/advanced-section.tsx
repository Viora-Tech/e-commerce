'use client'

import { ChevronDown, ChevronRight, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type AdvancedSectionProps = {
  devLog: boolean
  onChanged: () => Promise<void>
}

/** The development log channels: email (`log`) and SMS (`log-sms`), switched together. */
const LOGS = ['log', 'log-sms']

/**
 * Advanced, closed by default and shown only in development: the developer
 * log channel (prints messages instead of sending them) and every email design.
 */
export default function AdvancedSection({ devLog, onChanged }: AdvancedSectionProps) {
  // Hooks
  const setupCopy = useCopy(notificationsSettingsContent)
  const { advanced: copy } = useCopy(notificationsSettingsContent)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleDevLog = async (on: boolean) => {
    setSaving(true)
    try {
      const { settings } = await api.store.getNotifications()
      const enabled = on
        ? [...new Set([...settings.enabled, ...LOGS])]
        : settings.enabled.filter((id) => !LOGS.includes(id))
      await api.store.updateNotifications({ ...settings, enabled })
      toast.success(on ? copy.devLogOn : copy.devLogOff)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : setupCopy.list.saveFailed)
    } finally {
      setSaving(false)
    }
  }

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
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-1 flex-col gap-0.5">
                <label htmlFor="notifications-dev-log" className="text-body font-medium">
                  {copy.devLog}
                </label>
                <p className="text-caption text-muted-foreground">{copy.devLogHelp}</p>
              </div>
              <Switch
                id="notifications-dev-log"
                checked={devLog}
                disabled={saving}
                onCheckedChange={handleDevLog}
              />
            </div>
            <Button
              variant="outline"
              className="w-fit gap-1.5"
              nativeButton={false}
              render={<Link href="/dev/emails" />}
            >
              {copy.emailsPreview}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}
