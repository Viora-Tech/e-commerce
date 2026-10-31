'use client'

import type { MissingDetail, StorePolicy } from '@commerce/core'
import { type PolicyType, policyPath } from '@commerce/core/policies'
import type { RichTextValue } from '@commerce/richtext'
import { ExternalLink, Sparkle, TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import RichTextField from '@/components/fields/rich-text-field'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsTextRow from '@/components/settings/settings-text-row'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { policyEditorContent as copy, policiesContent } from '@/data/policies'
import { settingsContent } from '@/data/settings'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'
import { routes } from '@/lib/routes'

type PolicyEditorProps = {
  type: PolicyType
  /** Opened from "Create from template": fill the template straight away when nothing exists yet. */
  startFromTemplate: boolean
  storefrontOrigin: string
}

type Draft = { title: string; body: RichTextValue | null; published: boolean }

const draftOf = (p: StorePolicy): Draft => ({
  title: p.title,
  body: (p.body as RichTextValue | null) ?? null,
  published: p.published,
})

const hasText = (body: RichTextValue | null): boolean =>
  (body?.root.children?.length ?? 0) > 0 && JSON.stringify(body).includes('"text":"')

/** Settings → Policies → one policy: its text, from a template or typed, and whether it is live. */
export default function PolicyEditor({
  type,
  startFromTemplate,
  storefrontOrigin,
}: PolicyEditorProps) {
  // Hooks
  const announceSetup = useSetupNext()
  const [policy, setPolicy] = useState<StorePolicy | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [missing, setMissing] = useState<MissingDetail[]>([])
  const [editorKey, setEditorKey] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [filling, setFilling] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.policies.list().then(async (r) => {
      const found = r.policies.find((p) => p.type === type)
      if (!found || cancelled) return
      const loaded = draftOf(found)
      setPolicy(found)
      setDraft(loaded)
      setSaved(JSON.stringify(loaded))
      if (startFromTemplate && found.pageId === null) {
        const t = await api.policies.template({ type })
        if (cancelled) return
        setDraft({ ...loaded, body: t.body as RichTextValue, published: true })
        setMissing(t.missing)
        setEditorKey((k) => k + 1)
      }
    })
    return () => {
      cancelled = true
    }
  }, [type, startFromTemplate])

  // Helpers
  const fillTemplate = async () => {
    setFilling(true)
    try {
      const t = await api.policies.template({ type })
      setDraft((d) => (d ? { ...d, body: t.body as RichTextValue } : d))
      setMissing(t.missing)
      setEditorKey((k) => k + 1)
      toast.success(copy.filled)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setFilling(false)
      setConfirming(false)
    }
  }

  // Event handlers
  const handleTemplate = () => {
    if (draft && hasText(draft.body)) setConfirming(true)
    else void fillTemplate()
  }

  const handleSave = async () => {
    if (!draft) return
    if (draft.published && !hasText(draft.body)) {
      toast.error(copy.empty)
      return
    }
    setBusy(true)
    try {
      const next = await api.policies.save({
        type,
        title: draft.title,
        body: (draft.body as Record<string, unknown> | null) ?? null,
        published: draft.published,
      })
      // Keep the body the editor holds: swapping in the server's copy makes the editor re-emit
      // its own normalised version, which reads as a change and leaves the save bar up.
      const nextDraft = { ...draftOf(next), body: draft.body }
      setPolicy(next)
      setDraft(nextDraft)
      setSaved(JSON.stringify(nextDraft))
      toast.success(copy.saved)
      void announceSetup('policies')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (!saved) return
    setDraft(JSON.parse(saved) as Draft)
    setMissing([])
    setEditorKey((k) => k + 1)
  }

  // Render logic
  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== saved
  const path = policyPath(type)
  const live = policy?.published === true

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={settingsContent.general.unsaved}
        saveLabel={copy.save}
        discardLabel={settingsContent.general.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={policiesContent.names[type]}
        subtitle={
          policy?.updatedAt
            ? copy.updated(formatDate(policy.updatedAt))
            : policiesContent.hints[type]
        }
        back={{ label: copy.back, href: routes.settings.policies() }}
        actions={
          live ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`${storefrontOrigin}${path}`} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink aria-hidden="true" />
              {copy.view}
            </Button>
          ) : null
        }
      />
      {!draft ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <>
          {missing.length > 0 ? (
            <Alert>
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{copy.missingTitle}</AlertTitle>
              <AlertDescription>
                <p>{copy.missingBody}</p>
                <ul className="mt-1 list-disc pl-5">
                  {missing.map((m) => (
                    <li key={m}>
                      <Link className="underline" href={copy.missing[m].href}>
                        {copy.missing[m].label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <SettingsCard>
            <SettingsToggleRow
              id="policy-visible"
              label={copy.visible}
              description={draft.published ? copy.visibleHint(path) : copy.hiddenHint}
              checked={draft.published}
              onChange={(published) => setDraft({ ...draft, published })}
            />
            <SettingsTextRow
              id="policy-title"
              label={copy.title}
              value={draft.title}
              onChange={(title) => setDraft({ ...draft, title: title.slice(0, 120) })}
            />
            <div className="flex flex-col gap-3 pt-5">
              <Button
                variant="outline"
                className="self-start"
                onClick={handleTemplate}
                disabled={filling}
              >
                <Sparkle aria-hidden="true" />
                {hasText(draft.body) ? copy.refill : copy.fromTemplate}
              </Button>
              <RichTextField
                key={editorKey}
                label={copy.body}
                value={draft.body}
                onChange={(body) => setDraft((d) => (d ? { ...d, body } : d))}
                placeholder={copy.bodyPlaceholder}
                minHeight="24rem"
              />
            </div>
          </SettingsCard>
        </>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.confirmTitle}
        body={copy.confirmBody}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        busy={filling}
        onConfirm={() => void fillTemplate()}
      />
    </div>
  )
}
