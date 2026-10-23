'use client'

import type { WhatsappTemplateRef } from '@commerce/core/marketing'
import { useEffect, useState } from 'react'
import WhatsappTemplateCard, {
  type TemplatesResult,
} from '@/components/growth/campaigns/whatsapp-template-card'
import { api } from '@/lib/api-client'

type WhatsappTemplateFieldProps = {
  value: WhatsappTemplateRef | null
  onChange: (value: WhatsappTemplateRef | null) => void
}

/** The store's approved WhatsApp templates, through the same picker Growth's WhatsApp step uses. */
export default function WhatsappTemplateField({ value, onChange }: WhatsappTemplateFieldProps) {
  // Hooks
  const [templates, setTemplates] = useState<TemplatesResult | null>(null)

  useEffect(() => {
    let live = true
    api.marketing.campaigns
      .whatsappTemplates()
      .then((t) => live && setTemplates(t))
      .catch(
        () => live && setTemplates({ ok: false, reason: 'error', message: '' } as TemplatesResult),
      )
    return () => {
      live = false
    }
  }, [])

  // Render logic
  return <WhatsappTemplateCard value={value} templates={templates} onChange={onChange} bare />
}
