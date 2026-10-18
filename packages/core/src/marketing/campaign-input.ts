import { z } from 'zod'
import { type EmailBlock, EmailBlocksSchema } from './email'
import { type WhatsappTemplateRef, WhatsappTemplateRefSchema } from './whatsapp'

/** What the campaign editor saves. Pure, so the admin form validates with the same rules. */
export const CampaignInputSchema = z.object({
  kind: z.enum(['email', 'whatsapp']),
  name: z.string().trim().min(1).max(120),
  /** Saved customer segment; null means every subscriber. */
  segmentId: z.uuid().nullable().default(null),
  subject: z.string().trim().max(200).default(''),
  previewText: z.string().trim().max(200).default(''),
  blocks: EmailBlocksSchema.default([]),
  whatsapp: WhatsappTemplateRefSchema.nullable().default(null),
})
export type CampaignInput = z.infer<typeof CampaignInputSchema>

export type CampaignProblem = 'subject' | 'content' | 'template' | 'variables'

/** Why a campaign cannot be scheduled yet; empty when it is ready. */
export function campaignProblems(c: {
  kind: 'email' | 'whatsapp'
  subject: string
  blocks: EmailBlock[]
  whatsapp: WhatsappTemplateRef | null
  /** Placeholder count of the chosen template, when known. */
  variableCount?: number | undefined
}): CampaignProblem[] {
  const out: CampaignProblem[] = []
  if (c.kind === 'email') {
    if (!c.subject.trim()) out.push('subject')
    if (c.blocks.length === 0) out.push('content')
    return out
  }
  if (!c.whatsapp) return ['template']
  const want = c.variableCount ?? c.whatsapp.variables.length
  const filled = c.whatsapp.variables.slice(0, want).filter((v) => v.trim()).length
  if (filled < want) out.push('variables')
  return out
}

/** `Diwali Drop 2026` becomes `diwali-drop-2026` for utm_campaign. */
export function utmName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'campaign'
  )
}
