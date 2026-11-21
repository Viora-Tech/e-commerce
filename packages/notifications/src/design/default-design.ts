import type { EmailBlock } from '../emails/blocks'
import { sampleTemplateDataFor } from '../samples-dated'
import { composeEmail } from '../templates/compose'
import { INTERNAL } from '../templates/internal'
import { primaryActionFor } from '../templates/primary-action'
import type { TemplateData, TemplateId } from '../types'
import { keyBlocks, slotLocked } from './slots'
import { DESIGN_VERSION, type EmailTemplateDesign } from './types'

/**
 * The template's own blocks for one message: the composer's blocks plus the links an app adds
 * (an invoice), the same list the built-in email draws.
 */
export function composedBlocks(template: TemplateId, d: TemplateData): EmailBlock[] {
  const action = primaryActionFor(template, d)
  const composed = composeEmail(template, d, action)
  if (!composed) return []
  const extra = (d.links ?? []).filter((l) => l.url !== action?.url)
  return [
    ...composed.blocks,
    ...(extra.length > 0 ? [{ kind: 'links' as const, items: extra }] : []),
  ]
}

/** One built-in block as the editor lists it. */
export type DesignSlot = { key: string; kind: string; locked: boolean }

/** The template's built-in blocks in the sample message, for the editor's list. */
export function designSlots(template: TemplateId): DesignSlot[] {
  return keyBlocks(composedBlocks(template, sampleTemplateDataFor(template))).map((k) => ({
    key: k.key,
    kind: k.block.kind,
    locked: slotLocked(k.key),
  }))
}

/**
 * What "Edit design" opens with: exactly today's email as blocks. The store header, the intro,
 * every built-in block in order, then the help box and footer (team alerts have neither the
 * menu, the help box nor socials). Saving it unchanged sends the same email.
 */
export function defaultEmailDesign(template: TemplateId): EmailTemplateDesign {
  const internal = INTERNAL.has(template)
  return {
    version: DESIGN_VERSION,
    blocks: [
      { id: 'logo', type: 'logo', menu: !internal },
      { id: 'intro', type: 'intro' },
      ...designSlots(template).map((s) => ({ id: s.key, type: 'slot' as const, slot: s.key })),
      ...(internal ? [] : [{ id: 'help', type: 'help' as const }]),
      { id: 'footer', type: 'footer', social: !internal },
    ],
    removed: [],
  }
}
