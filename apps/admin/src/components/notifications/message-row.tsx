'use client'

import { Eye, Send } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { notificationsSettingsContent as copy } from '@/data/notifications'
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

const nameOf = (id: string) => copy.messages[id]?.name ?? id

/** One message: its name, when it goes, the channels it can use, the switch, Preview and Test. */
export default function MessageRow({
  message: m,
  saving,
  testing,
  onToggle,
  onPreview,
  onTest,
}: MessageRowProps) {
  // Render logic
  const name = nameOf(m.id)
  const switchId = `message-${m.id}`
  const badge =
    m.trigger === 'manual'
      ? copy.list.manualBadge
      : m.trigger === 'always'
        ? copy.list.alwaysBadge
        : null

  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <label
            htmlFor={m.switchable ? switchId : undefined}
            className="text-body font-medium text-foreground"
          >
            {name}
          </label>
          <p className="text-caption text-muted-foreground">{copy.messages[m.id]?.when}</p>
        </div>
        {m.switchable ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-caption text-muted-foreground sm:inline">
              {m.on ? copy.list.on : copy.list.off}
            </span>
            <Switch
              id={switchId}
              aria-label={copy.list.switchLabel(name)}
              checked={m.on}
              disabled={saving}
              onCheckedChange={onToggle}
            />
          </div>
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
          <Badge variant="neutral" className="shrink-0">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex gap-1.5">
          {m.channels.map((c) => (
            <Badge key={c} variant="secondary">
              {copy.channelNames[c]}
            </Badge>
          ))}
        </span>
        <span className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={onPreview}>
            <Eye aria-hidden="true" className="size-4" />
            {copy.list.preview}
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={onTest} disabled={testing}>
            {testing ? <Spinner /> : <Send aria-hidden="true" className="size-4" />}
            {testing ? copy.list.sending : copy.list.sendTest}
          </Button>
        </span>
      </div>
    </li>
  )
}
