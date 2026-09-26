import type { CampaignInput, EmailBlock, WhatsappTemplateRef } from '@commerce/core/marketing'
import { newEmailBlock, parseEmailBlocks } from '@commerce/core/marketing'
import type { api } from '@/lib/api-client'

export type LoadedCampaign = NonNullable<Awaited<ReturnType<typeof api.marketing.campaigns.get>>>
export type CampaignKind = 'email' | 'whatsapp'

export type CampaignForm = {
  kind: CampaignKind
  name: string
  segmentId: string | null
  subject: string
  previewText: string
  blocks: EmailBlock[]
  whatsapp: WhatsappTemplateRef | null
}

let counter = 0
/** Block ids only need to be unique inside one email. */
export function blockId(): string {
  counter += 1
  return `b${Date.now().toString(36)}${counter}`
}

/** A new email starts with a header and an empty text block. Fixed ids keep server and client renders identical. */
export function emptyForm(kind: CampaignKind, name: string): CampaignForm {
  return {
    kind,
    name,
    segmentId: null,
    subject: '',
    previewText: '',
    blocks:
      kind === 'email'
        ? [newEmailBlock('header', 'header-1'), newEmailBlock('text', 'text-1')]
        : [],
    whatsapp: null,
  }
}

export function fromCampaign(c: LoadedCampaign): CampaignForm {
  return {
    kind: c.kind,
    name: c.name,
    segmentId: c.segmentId,
    subject: c.subject,
    previewText: c.previewText,
    blocks: parseEmailBlocks(c.blocks),
    whatsapp: c.whatsapp,
  }
}

export function toInput(f: CampaignForm): CampaignInput {
  return {
    kind: f.kind,
    name: f.name.trim() || 'Untitled campaign',
    segmentId: f.segmentId,
    subject: f.subject,
    previewText: f.previewText,
    blocks: f.blocks,
    whatsapp: f.whatsapp,
  }
}

/** Moves the block at `index` by `delta` places, clamped to the list. */
export function moveBlock(blocks: EmailBlock[], index: number, delta: number): EmailBlock[] {
  const to = index + delta
  if (to < 0 || to >= blocks.length) return blocks
  const next = [...blocks]
  const [moved] = next.splice(index, 1)
  if (moved) next.splice(to, 0, moved)
  return next
}
