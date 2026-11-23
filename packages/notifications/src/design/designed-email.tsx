import { BlockList } from '../emails/blocks'
import { Body, Intro } from '../emails/components'
import { EmailLayout } from '../emails/layout'
import { accentColour } from '../emails/theme'
import { type FreeBlockContext, FreeBlockView } from './free-blocks'
import { Frame } from './free-parts'
import type { ResolvedBlock } from './resolve'
import { applySlotEdit } from './slot-edit'
import type { DesignStyles } from './style-types'
import { fillVariables } from './variables'

export type DesignedEmailProps = Omit<FreeBlockContext, 'accent'> & {
  previewText: string
  /** The built-in words, used where the merchant left the intro's fields empty. */
  eyebrow: string
  heading: string
  lead: string
  /** The store credit line and the merchant's hand-typed note, under the intro. */
  paragraphs: string[]
  blocks: ResolvedBlock[]
  styles?: DesignStyles | undefined
  internal?: boolean | undefined
}

/**
 * A transactional email drawn from a merchant's saved design (see `resolveDesign`). The font,
 * text colours and size are laid over the finished HTML by `applyDesignLook`.
 */
export function DesignedEmail(p: DesignedEmailProps) {
  const accent = p.styles?.accent ?? accentColour(p.brand)
  const ctx: FreeBlockContext = { ...p, accent }
  const own = (v: string | undefined, fallback: string) => {
    const filled = v ? fillVariables(v, p.data).trim() : ''
    return filled || fallback
  }
  return (
    <EmailLayout
      previewText={p.previewText}
      storeName={p.data.storeName}
      storeAddress={p.storeAddress}
      brand={p.brand}
      footerNote={p.footerNote}
      internal={p.internal}
      labels={p.labels}
      look={p.styles}
      bare
    >
      {p.blocks.map((r, i) => {
        const key = r.kind === 'slot' ? r.key : `${r.block.id}-${i}`
        if (r.kind === 'intro') {
          return (
            <Frame key={key} box={r.block.box}>
              <Intro
                eyebrow={own(r.block.eyebrow, p.eyebrow)}
                heading={own(r.block.heading, p.heading)}
                lead={own(r.block.lead, p.lead)}
                accent={accent}
                align={r.block.align}
              >
                {p.paragraphs.map((t) => (
                  <Body key={t}>{t}</Body>
                ))}
              </Intro>
            </Frame>
          )
        }
        if (r.kind === 'slot') {
          const edited = applySlotEdit(r.block, r.edit, p.data, p.styles?.button)
          return (
            <Frame key={key} box={r.box}>
              <BlockList blocks={[edited.block]} accent={edited.accent ?? accent} />
            </Frame>
          )
        }
        return (
          <Frame key={key} box={r.block.box}>
            <FreeBlockView block={r.block} ctx={ctx} />
          </Frame>
        )
      })}
    </EmailLayout>
  )
}
