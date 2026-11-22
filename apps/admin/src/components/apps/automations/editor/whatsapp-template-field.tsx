'use client'

import type { WhatsappTemplateRef } from '@commerce/core/marketing'
import WhatsappTemplateCard, {
  type TemplatesResult,
} from '@/components/growth/campaigns/whatsapp-template-card'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'

type WhatsappTemplateFieldProps = {
  value: WhatsappTemplateRef | null
  onChange: (value: WhatsappTemplateRef | null) => void
}

/** The store's approved WhatsApp templates, through the same picker Growth's WhatsApp step uses. */
export default function WhatsappTemplateField({ value, onChange }: WhatsappTemplateFieldProps) {
  // Hooks
  const { data, failed } = useLoad(() => api.marketing.campaigns.whatsappTemplates())

  // Render logic
  const templates = failed ? ({ ok: false, reason: 'error', message: '' } as TemplatesResult) : data
  return <WhatsappTemplateCard value={value} templates={templates} onChange={onChange} bare />
}
