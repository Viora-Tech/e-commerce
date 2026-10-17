'use client'

import type { BusinessGstView } from '@commerce/core'
import { useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import BusinessGstSettings from '../business-gst/business-gst-settings'
import SectionTabs from '../section-tabs'
import SettingsSection from '../settings-section'
import TaxesSettings, { type TaxesSaveState } from './taxes-settings'

type TaxesGstPageProps = {
  view: BusinessGstView
}

const GST_TAB = 'gst-numbers'

/** The cards' old `#anchors` (from the two pages this one replaced) and the tab each is on now. */
const HASH_TABS = {
  registration: 'tax-rules',
  charging: 'tax-rules',
  'how-gst-works': 'tax-rules',
  'invoice-numbers': 'invoices',
  'e-invoice': 'invoices',
} as const

/** What changes on the GST numbers tab that the other two tabs show (the default GSTIN). */
function gstKey(view: BusinessGstView): string {
  return view.registrations.map((r) => `${r.id}:${r.gstin}:${r.isDefault}:${r.active}`).join(',')
}

/**
 * Settings › Taxes & GST, one page in three tabs: GST numbers (once "Business and GST"), Tax rules
 * and Invoice numbers (once "Taxes & GST"). The tab is in the URL (`?tab=`).
 */
export default function TaxesGstPage({ view }: TaxesGstPageProps) {
  // Hooks
  const copy = useCopy(settingsContent)
  const [saveState, setSaveState] = useState<TaxesSaveState | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.taxesPage.title}
        subtitle={copy.taxesPage.intro}
        back={SETTINGS_BACK}
        save={
          saveState
            ? { dirty: saveState.dirty, saving: saveState.busy, onSave: saveState.save }
            : undefined
        }
      />
      <SectionTabs tabs={copy.sections.taxes} hashTabs={HASH_TABS}>
        <SettingsSection id={GST_TAB} className="flex flex-col gap-4">
          <BusinessGstSettings view={view} />
        </SettingsSection>
        <TaxesSettings refreshKey={gstKey(view)} gstTab={GST_TAB} onSaveState={setSaveState} />
      </SectionTabs>
    </div>
  )
}
