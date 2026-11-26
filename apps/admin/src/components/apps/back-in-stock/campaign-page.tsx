'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import LeaveGuard from '@/components/layout/leave-guard'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import CampaignButtonTab from './campaign-button-tab'
import CampaignEmailTab from './campaign-email-tab'
import CampaignNotificationsTab from './campaign-notifications-tab'
import CampaignPopupTab from './campaign-popup-tab'
import CampaignPreview from './campaign-preview'
import CampaignProductsTab from './campaign-products-tab'
import {
  CAMPAIGN_TABS,
  type CampaignForm,
  type CampaignTab,
  type CampaignTabProps,
  tabFrom,
} from './campaign-types'

const NEXT: Partial<Record<CampaignTab, CampaignTab>> = {
  notifications: 'button',
  button: 'popup',
  popup: 'email',
  email: 'products',
}

/**
 * The back-in-stock campaign in Essential's editor layout: the title with a Live/Off chip,
 * Turn off/on and Save; tabs Notification settings · Button · Pop up · Email · Products with a
 * "Continue to …" step at the end of each; the live preview in the right column.
 */
export default function CampaignPage() {
  // Hooks
  const { campaign: copy } = useCopy(backInStockContent)
  const search = useSearchParams()
  const [tab, setTab] = useState<CampaignTab>(() => tabFrom(search.get('tab')))
  const [form, setForm] = useState<CampaignForm | null>(null)
  const [saved, setSaved] = useState<CampaignForm | null>(null)
  const [busy, setBusy] = useState<'save' | 'toggle' | null>(null)
  const { failed, retry } = useLoad(async () => {
    const s = await api.backInStock.settings.get()
    setForm(s)
    setSaved(s)
    return s
  })

  // Helpers
  const patch = (next: Partial<CampaignForm>) => setForm((f) => (f ? { ...f, ...next } : f))
  const persist = async (next: CampaignForm, done: string) => {
    try {
      // `unlimited` is dropped by the procedure's input schema; it is never set from here.
      const result = await api.backInStock.settings.save(next)
      setForm(result)
      setSaved(result)
      toast.success(done)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    }
  }

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setBusy('save')
    await persist(form, copy.saved)
    setBusy(null)
  }
  const handleToggle = async () => {
    if (!form) return
    setBusy('toggle')
    const enabled = !form.enabled
    await persist({ ...form, enabled }, enabled ? copy.turnedOn : copy.turnedOff)
    setBusy(null)
  }

  // Early returns
  const back = { label: copy.back, href: routes.apps.page('back-in-stock') }
  if (!form) {
    return (
      <div className="mx-auto flex w-full max-w-[62rem] flex-col gap-5">
        <PageHeader title={copy.back} back={back} />
        {failed ? (
          <LoadFailedState size="page" heading={copy.loadFailed} failed={failed} onRetry={retry} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <DataCardSkeleton fields={3} />
            <DataCardSkeleton fields={0} lines={6} />
          </div>
        )}
      </div>
    )
  }

  // Render logic
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const props: CampaignTabProps = { form, patch }
  const next = NEXT[tab]

  return (
    // Essential's editor column: about 62rem, centred.
    <div className="mx-auto flex w-full max-w-[62rem] flex-col gap-5">
      <LeaveGuard when={dirty && busy === null} />
      <PageHeader
        title={form.title || copy.back}
        back={back}
        badges={
          <StatusChip tone={saved?.enabled ? 'success' : 'neutral'}>
            {saved?.enabled ? copy.live : copy.off}
          </StatusChip>
        }
        actions={
          <Button variant="outline" loading={busy === 'toggle'} onClick={handleToggle}>
            {saved?.enabled ? copy.turnOff : copy.turnOn}
          </Button>
        }
        save={{ dirty, saving: busy === 'save', onSave: handleSave, label: copy.save }}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(tabFrom(v))}>
        <TabsList className="h-auto flex-wrap justify-start">
          {CAMPAIGN_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {copy.tabs[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {tab === 'notifications' ? <CampaignNotificationsTab {...props} /> : null}
          {tab === 'button' ? <CampaignButtonTab {...props} /> : null}
          {tab === 'popup' ? <CampaignPopupTab {...props} /> : null}
          {tab === 'email' ? <CampaignEmailTab {...props} /> : null}
          {tab === 'products' ? <CampaignProductsTab {...props} /> : null}
          {next ? (
            <Button variant="outline" className="w-full" onClick={() => setTab(next)}>
              {copy.next[next as keyof typeof copy.next]}
            </Button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-4">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            {copy.preview}
          </p>
          <CampaignPreview form={form} tab={tab} />
        </div>
      </div>
    </div>
  )
}
