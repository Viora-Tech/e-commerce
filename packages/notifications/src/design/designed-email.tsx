import { BlockList } from '../emails/blocks'
import { Body, Intro } from '../emails/components'
import { EmailLayout } from '../emails/layout'
import { accentColour } from '../emails/theme'
import { type FreeBlockContext, FreeBlockView } from './free-blocks'
import type { ResolvedBlock } from './resolve'
import { fillVariables } from './variables'

export type DesignedEmailProps = FreeBlockContext & {
  previewText: string
  /** The built-in words, used where the merchant left the intro's fields empty. */
  eyebrow: string
  heading: string
  lead: string
  /** The store credit line and the merchant's hand-typed note, under the intro. */
  paragraphs: string[]
  blocks: ResolvedBlock[]
  internal?: boolean | undefined
}

/** A transactional email drawn from a merchant's saved design (see `resolveDesign`). */
export function DesignedEmail(p: DesignedEmailProps) {
  const accent = accentColour(p.brand)
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
      bare
    >
      {p.blocks.map((r, i) => {
        const key = r.kind === 'slot' ? r.key : `${r.block.id}-${i}`
        if (r.kind === 'intro') {
          return (
            <Intro
              key={key}
              eyebrow={own(r.block.eyebrow, p.eyebrow)}
              heading={own(r.block.heading, p.heading)}
              lead={own(r.block.lead, p.lead)}
              accent={accent}
            >
              {p.paragraphs.map((t) => (
                <Body key={t}>{t}</Body>
              ))}
            </Intro>
          )
        }
        if (r.kind === 'slot') return <BlockList key={key} blocks={[r.block]} accent={accent} />
        return <FreeBlockView key={key} block={r.block} ctx={p} />
      })}
    </EmailLayout>
  )
}
