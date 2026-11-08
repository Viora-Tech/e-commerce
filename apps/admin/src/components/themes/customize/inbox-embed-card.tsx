'use client'

import { INBOX_WIDGET_FIELDS, type InboxSettings, type InboxWidget } from '@commerce/core/inbox'
import { ChevronRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { customizeInboxEmbedContent } from '@/data/customize-inbox-embed'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  CHROME_BODY,
  CHROME_FOCUS,
  CHROME_GROUP_LABEL,
  CHROME_LABEL,
  CHROME_META,
} from '@/lib/customize-chrome'
import { FIELD_INPUT } from '@/lib/customize-field-styles'
import FieldFrame from './field-frame'
import InboxEmbedField from './inbox-embed-field'
import InboxEmbedPreview from './inbox-embed-preview'

type InboxEmbedCardProps = {
  /** Opens this card and closes the others, like every other embed row. */
  expanded: boolean
  onToggleOpen: () => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

/** Waits this long after the last change before saving, so typing a label saves once. */
const SAVE_DELAY_MS = 600
const MANAGE_HREF = '/sales-channels/inbox/settings'

/** The fields under their headings (Featured products, Colours, Activator, Typography, Borders). */
const GROUPS = INBOX_WIDGET_FIELDS.filter((f) => f.key !== 'enabled').reduce<
  { title: string; fields: typeof INBOX_WIDGET_FIELDS }[]
>((all, f) => {
  const last = all.at(-1)
  if (last?.title === f.group) last.fields.push(f)
  else all.push({ title: f.group, fields: [f] })
  return all
}, [])

/**
 * The Inbox app's "Online store chat" embed (Shopify Inbox's app embed): a switch, the greeting
 * and the chat button's look, with a live picture of the button. These are the Inbox app's own
 * settings (`inbox.settings.save`), not the theme's, so they save as they change; "Manage app"
 * opens the rest of the Inbox settings.
 */
export default function InboxEmbedCard({ expanded, onToggleOpen }: InboxEmbedCardProps) {
  // Hooks
  const copy = useCopy(customizeInboxEmbedContent)
  const greetingId = useId()
  const [settings, setSettings] = useState<InboxSettings | null>(null)
  const [state, setState] = useState<SaveState>('idle')
  const [loadFailed, setLoadFailed] = useState(false)
  const pending = useRef<Partial<InboxSettings> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let live = true
    api.inbox.settings
      .get()
      .then((r) => {
        if (live) setSettings(r.settings)
      })
      .catch(() => {
        if (live) setLoadFailed(true)
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // Event handlers
  const handleSave = async () => {
    const patch = pending.current
    pending.current = null
    if (!patch) return
    setState('saving')
    try {
      await api.inbox.settings.save(patch)
      setState('saved')
    } catch {
      setState('failed')
    }
  }
  const handlePatch = (next: Partial<InboxSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...next })
    pending.current = { ...pending.current, ...next }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(handleSave, SAVE_DELAY_MS)
  }
  const handleWidget = (patch: Partial<InboxWidget>) => {
    if (settings) handlePatch({ widget: { ...settings.widget, ...patch } })
  }

  // Early returns
  if (loadFailed) {
    return (
      <li className="rounded-xl border border-border bg-card p-3">
        <p className={cn(CHROME_LABEL, 'text-foreground')}>{copy.label}</p>
        <p className={CHROME_META}>{copy.loadFailed}</p>
      </li>
    )
  }

  // Render logic
  const widget = settings?.widget
  const status =
    state === 'saving'
      ? copy.saving
      : state === 'saved'
        ? copy.saved
        : state === 'failed'
          ? copy.failed
          : null

  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={expanded}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md text-left',
            CHROME_FOCUS,
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none',
              expanded && 'rotate-90',
            )}
          />
          <span className="flex min-w-0 flex-col">
            <span className={cn(CHROME_LABEL, 'truncate text-foreground')}>{copy.label}</span>
            <span className={cn(CHROME_META, 'truncate')}>{copy.app}</span>
          </span>
        </button>
        <Switch
          checked={widget?.enabled ?? false}
          disabled={!widget}
          onCheckedChange={(on) => handleWidget({ enabled: on })}
          aria-label={copy.label}
        />
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div inert={!expanded} className="min-h-0 overflow-hidden">
          {settings && widget ? (
            <div className="flex flex-col gap-3 border-t border-border p-3">
              <p className={cn(CHROME_BODY, 'text-muted-foreground')}>{copy.description}</p>
              <span className={CHROME_GROUP_LABEL}>{copy.preview}</span>
              <InboxEmbedPreview
                widget={widget}
                greeting={settings.greeting}
                fallbackLabel={copy.previewChat}
                fallbackGreeting={copy.greetingPlaceholder}
                title={copy.app}
              />
              <FieldFrame label={copy.greeting} htmlFor={greetingId}>
                <Textarea
                  id={greetingId}
                  value={settings.greeting}
                  maxLength={300}
                  placeholder={copy.greetingPlaceholder}
                  onChange={(e) => handlePatch({ greeting: e.target.value })}
                  className={FIELD_INPUT}
                />
              </FieldFrame>
              {GROUPS.map((g) => (
                <div key={g.title} className="flex flex-col gap-2.5">
                  <span className={CHROME_GROUP_LABEL}>{g.title}</span>
                  {g.fields.map((f) => (
                    <InboxEmbedField
                      key={f.key}
                      field={f}
                      widget={widget}
                      onChange={handleWidget}
                    />
                  ))}
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={MANAGE_HREF}
                  className={cn(
                    'rounded-sm text-xs font-medium text-primary hover:underline',
                    CHROME_FOCUS,
                  )}
                >
                  {copy.manage}
                </Link>
                {status ? (
                  <span
                    role="status"
                    className={cn(
                      'text-xs',
                      state === 'failed' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {status}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}
