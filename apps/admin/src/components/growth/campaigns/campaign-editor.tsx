'use client'

import { type CampaignProblem, campaignProblems } from '@commerce/core/marketing'
import { CircleAlert, CircleCheck, CircleDashed, Send, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SaveErrorAlert from '@/components/approvals/save-error-alert'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { campaignEditorContent as copy } from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CampaignSettingsCard from './campaign-settings-card'
import EmailContentSwitch from './email-content-switch'
import EmailPreview from './email-preview'
import {
  type CampaignForm,
  type CampaignKind,
  emptyForm,
  fromCampaign,
  type LoadedCampaign,
  toInput,
} from './form-state'
import SendDialog from './send-dialog'
import TestSendDialog from './test-send-dialog'
import WhatsappPreview from './whatsapp-preview'
import WhatsappTemplateCard, { type TemplatesResult } from './whatsapp-template-card'

type CampaignEditorProps = {
  campaign: LoadedCampaign | null
  kind: CampaignKind
  segments: { id: string; name: string }[]
  storeName: string
  storefrontUrl: string
  merchantEmail: string
  setup: { email: string | null; whatsapp: string | null }
  /** A new campaign opened from a segment's page, aimed at it (audit #182). */
  segmentId?: string | null | undefined
}

function initial(
  campaign: LoadedCampaign | null,
  kind: CampaignKind,
  segmentId: string | null,
): CampaignForm {
  if (campaign) return fromCampaign(campaign)
  const blank = emptyForm(kind, kind === 'email' ? copy.newEmail : copy.newWhatsapp)
  return segmentId ? { ...blank, segmentId } : blank
}

/** Draft editor for email campaigns (block composer with live preview) and WhatsApp broadcasts. */
export default function CampaignEditor({
  campaign,
  kind,
  segments,
  storeName,
  storefrontUrl,
  merchantEmail,
  setup,
  segmentId = null,
}: CampaignEditorProps) {
  // Hooks
  const router = useRouter()
  const [start] = useState(() => initial(campaign, kind, segmentId))
  const [form, setForm] = useState(start)
  const [saved, setSaved] = useState(() => JSON.stringify(start))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reach, setReach] = useState<number | null>(null)
  const [templates, setTemplates] = useState<TemplatesResult | null>(null)
  const [dialog, setDialog] = useState<'test' | 'send' | 'delete' | null>(null)

  useEffect(() => {
    let live = true
    api.marketing.campaigns.audience({ kind: form.kind, segmentId: form.segmentId }).then((r) => {
      if (live) setReach(r.count)
    })
    return () => {
      live = false
    }
  }, [form.kind, form.segmentId])

  useEffect(() => {
    if (form.kind !== 'whatsapp') return
    api.marketing.campaigns.whatsappTemplates().then(setTemplates)
  }, [form.kind])

  // Helpers
  const patch = (p: Partial<CampaignForm>) => setForm((f) => ({ ...f, ...p }))

  const persist = async (): Promise<string | null> => {
    const data = toInput(form)
    const row = campaign
      ? await api.marketing.campaigns.update({ id: campaign.id, data })
      : await api.marketing.campaigns.create(data)
    if (!row) throw new Error(copy.toasts.failed)
    setSaved(JSON.stringify(form))
    return row.id
  }

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      const id = await persist()
      toast.success(campaign ? copy.toasts.saved : copy.toasts.created)
      if (!campaign && id) router.replace(routes.growth.campaign(id))
      else router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleSend = async (at: Date | null) => {
    setBusy(true)
    setError(null)
    try {
      const id = await persist()
      if (!id) return
      await api.marketing.campaigns.schedule({
        id,
        at: at ? at.toISOString() : null,
        variableCount: chosenCount,
      })
      toast.success(at ? copy.schedule.scheduled : copy.schedule.sent)
      setDialog(null)
      router.replace(routes.growth.campaign(id))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!campaign) return
    setBusy(true)
    try {
      await api.marketing.campaigns.delete({ id: campaign.id })
      toast.success(copy.toasts.deleted)
      router.push(routes.growth.campaigns())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.toasts.failed)
      setBusy(false)
    }
  }

  // Render logic
  const dirty = JSON.stringify(form) !== saved
  const chosen =
    templates?.ok && form.whatsapp
      ? templates.templates.find(
          (t) => t.name === form.whatsapp?.name && t.language === form.whatsapp?.language,
        )
      : undefined
  const chosenCount = chosen?.variableCount
  const problems: CampaignProblem[] = campaignProblems({ ...form, variableCount: chosenCount })
  const channelMissing = form.kind === 'email' ? !setup.email : !setup.whatsapp
  const title = campaign ? form.name : form.kind === 'email' ? copy.newEmail : copy.newWhatsapp

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-6 md:pt-5 md:pb-8">
      <SaveBar
        open={dirty}
        message={copy.saveBar.message}
        saveLabel={copy.saveBar.save}
        discardLabel={copy.saveBar.discard}
        onSave={handleSave}
        onDiscard={() => setForm(JSON.parse(saved) as CampaignForm)}
        saving={busy}
      />
      <PageHeader
        title={title}
        back={{ label: copy.breadcrumb, href: routes.growth.campaigns() }}
        actions={
          <div className="flex items-center gap-2">
            {campaign ? (
              <Button
                variant="ghost"
                onClick={() => setDialog('delete')}
                aria-label={copy.delete.action}
              >
                <Trash2 />
              </Button>
            ) : null}
            {form.kind === 'email' ? (
              <Button variant="outline" onClick={() => setDialog('test')} disabled={channelMissing}>
                <Send aria-hidden="true" />
                {copy.test.action}
              </Button>
            ) : null}
            {!campaign && !dirty ? null : (
              <Button
                onClick={() => setDialog('send')}
                disabled={busy || problems.length > 0 || channelMissing}
              >
                <Send />
                {copy.schedule.action}
              </Button>
            )}
          </div>
        }
      />
      {channelMissing && form.kind === 'email' ? (
        <Alert>
          <CircleAlert />
          <AlertDescription>
            {copy.channel.noEmail}{' '}
            <Link href={routes.settings.notifications()} className="underline">
              {copy.channel.settings}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? <SaveErrorAlert message={error} /> : null}
      {problems.length && (campaign || dirty) ? (
        <Alert>
          <CircleAlert />
          <AlertTitle>{copy.fixThese}</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-0.5 pl-4">
              {problems.map((p) => (
                <li key={p}>{copy.problems[p]}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <CampaignSettingsCard form={form} segments={segments} reach={reach} onChange={patch} />
          {form.kind === 'email' ? (
            <EmailContentSwitch
              editor={form.editor}
              blocks={form.blocks}
              design={form.design}
              storefrontUrl={storefrontUrl}
              onChange={patch}
            />
          ) : (
            <WhatsappTemplateCard
              value={form.whatsapp}
              templates={templates}
              onChange={(whatsapp) => patch({ whatsapp })}
            />
          )}
        </div>
        {form.kind === 'email' ? (
          <EmailPreview
            storeName={storeName}
            storefrontUrl={storefrontUrl}
            subject={form.subject}
            previewText={form.previewText}
            blocks={form.blocks}
            designHtml={form.editor === 'visual' ? form.design?.html : undefined}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-5">
            <WhatsappPreview
              value={form.whatsapp}
              body={chosen?.body ?? null}
              storeName={storeName}
            />
            <DataCard title={copy.beforeSend.heading}>
              <ul className="flex flex-col gap-2 text-body">
                {[
                  { ok: Boolean(chosen), label: copy.beforeSend.approved },
                  {
                    ok: !problems.includes('variables') && Boolean(chosen),
                    label: copy.beforeSend.variables,
                  },
                  { ok: (reach ?? 0) > 0, label: copy.beforeSend.optedIn(reach ?? 0) },
                ].map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.ok ? (
                      <CircleCheck className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className={c.ok ? 'text-foreground' : 'text-muted-foreground'}>
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </DataCard>
          </div>
        )}
      </div>
      <TestSendDialog
        open={dialog === 'test'}
        onOpenChange={(o) => setDialog(o ? 'test' : null)}
        form={form}
        defaultTo={merchantEmail}
      />
      <SendDialog
        open={dialog === 'send'}
        onOpenChange={(o) => setDialog(o ? 'send' : null)}
        reach={reach}
        busy={busy}
        error={error}
        onConfirm={handleSend}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => setDialog(o ? 'delete' : null)}
        title={copy.delete.title}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        busy={busy}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
