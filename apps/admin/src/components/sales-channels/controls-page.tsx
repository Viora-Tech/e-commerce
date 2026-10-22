'use client'

import type { AgentControlsView } from '@commerce/core'
import type { AgentControls } from '@commerce/core/sales-channels'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import MoneyInput from '@/components/fields/money-input'
import TagInput from '@/components/fields/tag-input'
import ChoiceCard from '@/components/layout/choice-card'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { chipStatus } from '@/lib/channel-status'
import { routes } from '@/lib/routes'
import ChannelLogo from './channel-logo'
import ChannelStatusChip from './channel-status-chip'
import SwitchRow from './switch-row'

type ControlsPageProps = {
  view: AgentControlsView
  collections: { id: string; title: string }[]
}

/** Figma "Agentic sales · Controls": what agents may show, at what price, and how shoppers pay. */
export default function ControlsPage({ view: initial, collections }: ControlsPageProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.controls)
  const agents = useCopy(salesChannelsContent.agents)
  const back = useCopy(salesChannelsContent.overview.title)
  const format = useFormat()
  const [view, setView] = useState(initial)
  const [form, setForm] = useState<AgentControls>(initial.controls)
  const [saving, setSaving] = useState(false)

  // Helpers
  const patch = (p: Partial<AgentControls>) => setForm((f) => ({ ...f, ...p }))
  const toggleCollection = (id: string, on: boolean) =>
    patch({
      collectionIds: on ? [...form.collectionIds, id] : form.collectionIds.filter((c) => c !== id),
    })

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const next = await api.salesChannels.saveControls(form)
      setView(next)
      setForm(next.controls)
      toast.success(copy.saved)
    } catch {
      toast.error(copy.failed)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => setForm(view.controls)

  // Render logic
  const dirty = JSON.stringify(form) !== JSON.stringify(view.controls)
  const { products } = view
  const rows = copy.rows

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={{ label: back, href: routes.salesChannels.agentic() }}
        save={{ dirty, saving, onSave: handleSave }}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-4">
          <DataCard title={copy.which}>
            <div className="flex flex-col gap-2">
              <ChoiceCard
                layout="row"
                showCheck
                label={copy.all}
                description={copy.allBody(products.active)}
                selected={form.visibility === 'all'}
                onSelect={() => patch({ visibility: 'all' })}
              />
              <ChoiceCard
                layout="row"
                showCheck
                label={copy.chosen}
                description={copy.chosenBody}
                selected={form.visibility === 'collections'}
                onSelect={() => patch({ visibility: 'collections' })}
              />
            </div>
            {form.visibility === 'collections' ? (
              <fieldset className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-md border border-border p-3">
                <legend className="sr-only">{copy.collections}</legend>
                {collections.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 text-body">
                    <Checkbox
                      id={`agent-collection-${c.id}`}
                      checked={form.collectionIds.includes(c.id)}
                      onCheckedChange={(v) => toggleCollection(c.id, v === true)}
                    />
                    <label htmlFor={`agent-collection-${c.id}`}>{c.title}</label>
                  </div>
                ))}
              </fieldset>
            ) : null}
            <div className="mt-2 border-t border-border">
              <SwitchRow
                id="agent-hide-tagged"
                label={copy.hideTagged}
                description={copy.hideTaggedBody}
                checked={form.hideTagged}
                onChange={(hideTagged) => patch({ hideTagged })}
              />
              {form.hideTagged ? (
                <div className="flex flex-col gap-1.5 pb-1">
                  <Label htmlFor="agent-hidden-tags">{copy.tags}</Label>
                  <TagInput
                    id="agent-hidden-tags"
                    tags={form.hiddenTags}
                    suggestions={[]}
                    onChange={(hiddenTags) => patch({ hiddenTags })}
                  />
                  <p className="text-caption text-muted-foreground">{copy.tagsHint}</p>
                </div>
              ) : null}
            </div>
          </DataCard>
          <DataCard title={copy.prices}>
            <div className="-my-3 divide-y divide-border">
              <SwitchRow
                id="agent-store-prices"
                label={copy.storePrices}
                description={copy.storePricesBody}
                checked={form.storePrices}
                onChange={(storePrices) => patch({ storePrices })}
              />
              <SwitchRow
                id="agent-compare-at"
                label={copy.compareAt}
                description={copy.compareAtBody}
                checked={form.showCompareAt}
                onChange={(showCompareAt) => patch({ showCompareAt })}
              />
            </div>
          </DataCard>
          <DataCard title={copy.checkout}>
            <div className="flex flex-col gap-2">
              <ChoiceCard
                layout="row"
                showCheck
                label={copy.inAgent}
                description={copy.inAgentBody}
                selected={form.checkout === 'agent'}
                onSelect={() => patch({ checkout: 'agent' })}
              />
              <ChoiceCard
                layout="row"
                showCheck
                label={copy.onStore}
                description={copy.onStoreBody}
                selected={form.checkout === 'store'}
                onSelect={() => patch({ checkout: 'store' })}
              />
            </div>
          </DataCard>
          <DataCard title={copy.bigOrders}>
            <div className="-mt-3">
              <SwitchRow
                id="agent-hold-large"
                label={copy.hold}
                description={copy.holdBody}
                checked={form.holdLarge}
                onChange={(holdLarge) => patch({ holdLarge })}
              />
            </div>
            {form.holdLarge ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-hold-amount">{copy.amount}</Label>
                <MoneyInput
                  id="agent-hold-amount"
                  value={String(form.holdAbovePaise / 100)}
                  onChange={(v) =>
                    patch({ holdAbovePaise: Math.max(0, Math.round((Number(v) || 0) * 100)) })
                  }
                />
              </div>
            ) : null}
          </DataCard>
        </div>
        <div className="flex flex-col gap-4">
          <DataCard title={copy.visibleHeading}>
            <KeyValueList
              variant="grid"
              rows={[
                {
                  label: `${rows.products} · ${rows.productsOf(products.active)}`,
                  value: format.number(products.visible),
                  strong: true,
                },
                {
                  label: `${rows.hidden} · ${form.hiddenTags.join(', ')}`,
                  value: format.number(products.hiddenByTag),
                  hidden: !view.controls.hideTagged,
                },
                {
                  label: `${rows.prices} · ${rows.pricesStore}`,
                  value: view.controls.storePrices ? rows.sameAsStore : rows.own,
                },
                {
                  label: `${rows.checkout} · ${rows.checkoutWhere}`,
                  value: view.controls.checkout === 'agent' ? rows.inAgent : rows.onStore,
                },
                {
                  label: `${rows.held} · ${rows.heldWhen}`,
                  value: view.controls.holdLarge
                    ? format.money(view.controls.holdAbovePaise)
                    : rows.off,
                },
              ]}
            />
          </DataCard>
          <DataCard title={copy.agentsHeading}>
            <ul className="-my-1 flex flex-col divide-y divide-border">
              {view.agents.map((a) => (
                <li key={a.agent} className="flex items-center gap-3 py-2.5">
                  <ChannelLogo channel={a.agent} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-body font-medium">
                    {agents[a.agent].name}
                  </span>
                  <ChannelStatusChip status={chipStatus(a.state)} />
                </li>
              ))}
            </ul>
          </DataCard>
        </div>
      </div>
    </PageBody>
  )
}
