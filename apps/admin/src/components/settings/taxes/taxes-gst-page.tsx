'use client'

import type { BusinessGstView } from '@commerce/core'
import { settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import BusinessGstSettings from '../business-gst/business-gst-settings'
import SectionTabs from '../section-tabs'
import SettingsPageHeader from '../settings-page-header'
import SettingsSection from '../settings-section'
import TaxesSettings from './taxes-settings'

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

  return (
    <div className="flex flex-col gap-4">
      <SettingsPageHeader title={copy.taxesPage.title} subtitle={copy.taxesPage.intro} />
      <SectionTabs tabs={copy.sections.taxes} hashTabs={HASH_TABS}>
        <SettingsSection id={GST_TAB} className="flex flex-col gap-4">
          <BusinessGstSettings view={view} />
        </SettingsSection>
        <TaxesSettings refreshKey={gstKey(view)} gstTab={GST_TAB} />
      </SectionTabs>
    </div>
  )
}
