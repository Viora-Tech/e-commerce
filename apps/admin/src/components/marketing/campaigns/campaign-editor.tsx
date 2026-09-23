'use client'

import { type CampaignProblem, campaignProblems } from '@commerce/core/marketing'
import { CircleAlert, Send, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { campaignEditorContent as copy } from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import CampaignSettingsCard from './campaign-settings-card'
import DeleteCampaignDialog from './delete-campaign-dialog'
import EmailContentCard from './email-content-card'
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
}

function initial(campaign: LoadedCampaign | null, kind: CampaignKind): CampaignForm {
  return campaign
    ? fromCampaign(campaign)
    : emptyForm(kind, kind === 'email' ? copy.newEmail : copy.newWhatsapp)
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
}: CampaignEditorProps) {
  // Hooks
  const router = useRouter()
  const [start] = useState(() => initial(campaign, kind))
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
      if (!campaign && id) router.replace(`/marketing/campaigns/${id}`)
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
      router.replace(`/marketing/campaigns/${id}`)
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
      router.push('/marketing/campaigns')
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
    <PageBody width="wide">
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
        breadcrumbs={[{ label: copy.breadcrumb, href: '/marketing/campaigns' }, { label: title }]}
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
            <Link href="/settings/notifications" className="underline">
              {copy.channel.settings}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {problems.length && (campaign || dirty) ? (
        <ul className="flex flex-col gap-1 text-caption text-muted-foreground">
          {problems.map((p) => (
            <li key={p}>{copy.problems[p]}</li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <CampaignSettingsCard form={form} segments={segments} reach={reach} onChange={patch} />
          {form.kind === 'email' ? (
            <EmailContentCard blocks={form.blocks} onChange={(blocks) => patch({ blocks })} />
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
          />
        ) : (
          <WhatsappPreview
            value={form.whatsapp}
            body={chosen?.body ?? null}
            storeName={storeName}
          />
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
      <DeleteCampaignDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => setDialog(o ? 'delete' : null)}
        busy={busy}
        onConfirm={handleDelete}
      />
    </PageBody>
  )
}
