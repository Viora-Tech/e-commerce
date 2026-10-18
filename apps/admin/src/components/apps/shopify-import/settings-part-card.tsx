'use client'

import type {
  ScopeHandle,
  SettingsItem,
  SettingsPart,
} from '@commerce/plugin-shopify-import/client'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import Link from 'next/link'
import { useState } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportSettingsContent } from '@/data/shopify-import-settings'
import { useCopy } from '@/hooks/use-copy'
import SettingsItemRow from './settings-item-row'

type SettingsPartCardProps = {
  part: SettingsPart
  items: SettingsItem[]
  status: { label: string; variant: 'success' | 'info' | 'neutral' | 'attention' | 'danger' }
  missingScopes?: ScopeHandle[] | undefined
  error?: string | undefined
  /** The plan: a tick box to choose the part. Left out on the report. */
  choose?: { checked: boolean; disabled: boolean; onChange: (on: boolean) => void } | undefined
  /** The report: "3 changes saved". */
  summary?: string | null | undefined
}

/** Lines shown before "Show all". */
const FIRST = 6

const base = shopifyImportContent.base

/** Lines have no id: key each by what it says, numbering repeats of the same line. */
function keyed(items: SettingsItem[]): { key: string; item: SettingsItem }[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const text = [item.action, item.subject, item.owner, item.name, item.reason, item.detail].join(
      '|',
    )
    const n = (seen.get(text) ?? 0) + 1
    seen.set(text, n)
    return { key: `${text}#${n}`, item }
  })
}

/** One part of Store settings: what it covers, its lines, and how to fix what could not come over. */
export default function SettingsPartCard({
  part,
  items,
  status,
  missingScopes,
  error,
  choose,
  summary,
}: SettingsPartCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportSettingsContent)
  const connect = useCopy(shopifyImportContent.connect)
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleToggle = () => setOpen((v) => !v)

  // Render logic
  const info = copy.parts[part]
  const id = `settings-part-${part}`
  const visible = open ? items : items.slice(0, FIRST)
  const scopes = (missingScopes ?? []).map((s) => connect.scopeNames[s]).join(', ')

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <label htmlFor={id} className="flex min-w-0 items-start gap-3">
          {choose ? (
            <Checkbox
              id={id}
              className="mt-0.5"
              checked={choose.checked}
              disabled={choose.disabled}
              onCheckedChange={(v) => choose.onChange(Boolean(v))}
            />
          ) : null}
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold text-ink-strong">{info.title}</span>
            <span className="text-body text-muted-foreground">{info.body}</span>
            {summary ? <span className="text-caption text-ink-strong">{summary}</span> : null}
          </span>
        </label>
        <StatusChip tone={status.variant} className="shrink-0">
          {status.label}
        </StatusChip>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {missingScopes?.length ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-body text-muted-foreground">{copy.reconnect(scopes)}</p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`${base}/connect`} />}
            >
              {copy.reconnectAction}
            </Button>
          </div>
        ) : null}
        {error ? <p className="break-words text-body text-destructive">{error}</p> : null}
        {items.length === 0 && !missingScopes?.length && !error ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : null}
        {items.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {keyed(visible).map(({ key, item }) => (
              <SettingsItemRow key={key} item={item} />
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {items.length > FIRST ? (
            <Button variant="ghost" size="sm" onClick={handleToggle}>
              {open ? copy.showLess : copy.showAll(items.length)}
            </Button>
          ) : null}
          <Button
            variant="link"
            size="sm"
            className="px-0"
            nativeButton={false}
            render={<Link href={copy.fixHref[part]} />}
          >
            {copy.openSettings}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
