'use client'

import type { BusinessGstView } from '@commerce/core'
import { settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import BusinessGstSettings from '../business-gst/business-gst-settings'
import TaxesSettings from './taxes-settings'

type TaxesGstPageProps = {
  view: BusinessGstView
}

/** What changes on the GST numbers row that the other rows show (the default GSTIN). */
function gstKey(view: BusinessGstView): string {
  return view.registrations.map((r) => `${r.id}:${r.gstin}:${r.isDefault}:${r.active}`).join(',')
}

/**
 * Settings › Taxes & GST, Shopify-style (#147): rows for GST numbers, registration, how GST is
 * charged, invoice numbers and e-invoicing, each opening its detail in place (`?open=`).
 */
export default function TaxesGstPage({ view }: TaxesGstPageProps) {
  // Hooks
  const copy = useCopy(settingsContent)

  return (
    <div className="flex flex-col gap-4">
      <TaxesSettings
        refreshKey={gstKey(view)}
        gstCount={view.registrations.length}
        gstNumbers={<BusinessGstSettings view={view} />}
        header={{
          title: copy.taxesPage.title,
          subtitle: copy.taxesPage.intro,
        }}
      />
    </div>
  )
}
