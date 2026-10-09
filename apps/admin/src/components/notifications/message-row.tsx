'use client'

import { Eye, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { MessageRowData } from './types'

type MessageRowProps = {
  message: MessageRowData
  saving: boolean
  testing: boolean
  onToggle: (on: boolean) => void
  onPreview: () => void
  onTest: () => void
}

/** One message as a table row: name and when it goes, channels, the switch, Preview and Test. */
export default function MessageRow({
  message: m,
  saving,
  testing,
  onToggle,
  onPreview,
  onTest,
}: MessageRowProps) {
  // Hooks
  const copy = useCopy(notificationsSettingsContent)

  // Render logic
  const name = copy.messages[m.id]?.name ?? m.id
  const switchId = `message-${m.id}`
  const badge =
    m.trigger === 'manual'
      ? copy.list.manualBadge
      : m.trigger === 'always'
        ? copy.list.alwaysBadge
        : null

  return (
    <SettingsTableRow>
      <SettingsTableCell>
        <label
          htmlFor={m.switchable ? switchId : undefined}
          className="block font-semibold text-ink-strong"
        >
          {name}
        </label>
        <p className="text-caption font-normal text-muted-foreground">
          {copy.messages[m.id]?.when}
        </p>
      </SettingsTableCell>
      <SettingsTableCell className="text-muted-foreground">
        {m.channels.map((c) => copy.channelNames[c]).join(', ')}
      </SettingsTableCell>
      <SettingsTableCell center>
        {m.switchable ? (
          <span className="inline-flex items-center gap-2">
            <StatusChip>{m.on ? copy.list.on : copy.list.off}</StatusChip>
            <Switch
              id={switchId}
              aria-label={copy.list.switchLabel(name)}
              checked={m.on}
              disabled={saving}
              onCheckedChange={onToggle}
            />
          </span>
        ) : m.trigger === 'app' && m.appId ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.apps.settings(m.appId)} />}
          >
            {copy.list.openApp}
          </Button>
        ) : badge ? (
          <StatusChip>{badge}</StatusChip>
        ) : null}
      </SettingsTableCell>
      <SettingsTableCell className="w-24 p-0 last:pr-2 md:last:pr-2">
        <RowActionsCell>
          <Button size="icon" variant="ghost" aria-label={copy.list.preview} onClick={onPreview}>
            <Eye aria-hidden="true" className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={testing ? copy.list.sending : copy.list.sendTest}
            onClick={onTest}
            disabled={testing}
          >
            {testing ? <Spinner /> : <Send aria-hidden="true" className="size-4" />}
          </Button>
        </RowActionsCell>
      </SettingsTableCell>
    </SettingsTableRow>
  )
}
