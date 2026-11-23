import { Img, Link, Section, Text } from '@react-email/components'
import { BLOCK_PAD } from '../emails/blocks/tokens'
import { Body, DividerLabel, PrimaryButton } from '../emails/components'
import { EmailFooter, SocialRow } from '../emails/footer'
import { EmailHeader } from '../emails/header'
import { HelpBox } from '../emails/help-box'
import { theme } from '../emails/theme'
import { MoreBlockView } from './free-blocks-more'
import {
  contentWidth,
  type FreeBlockContext,
  filledLink,
  imageSrc,
  paragraphStyle,
  RichTextView,
} from './free-parts'
import { buttonLook } from './slot-edit'
import type { FreeBlock } from './types'
import { fillVariables } from './variables'

export type { FreeBlockContext } from './free-parts'

const SPACER = { small: '12px', medium: '28px', large: '48px' } as const

/** One block a merchant placed in their design, drawn with the built-in email's styles. */
export function FreeBlockView({ block: b, ctx }: { block: FreeBlock; ctx: FreeBlockContext }) {
  const d = ctx.data
  const align = b.box?.align
  const fill = (t: string | undefined) => (t ? fillVariables(t, d).trim() : '')
  switch (b.type) {
    case 'logo':
      return (
        <EmailHeader storeName={d.storeName} brand={ctx.brand} menu={b.menu} labels={ctx.labels} />
      )
    case 'heading': {
      const text = fill(b.text)
      if (!text) return null
      const large = b.size === 'large'
      return (
        <Section className="k-pad" style={{ ...BLOCK_PAD, textAlign: align ?? 'center' }}>
          <Text
            className={large ? 'k-title' : undefined}
            style={{
              margin: 0,
              fontSize: large ? '34px' : '22px',
              lineHeight: large ? '40px' : '28px',
              fontWeight: 400,
              color: b.colour ?? theme.ink,
            }}
          >
            {text}
          </Text>
        </Section>
      )
    }
    case 'text': {
      const filled = fillVariables(b.text, d)
      const at = align ?? b.align
      if (b.rich) {
        if (!filled.trim()) return null
        return (
          <Section className="k-pad" style={BLOCK_PAD}>
            <RichTextView
              text={filled}
              style={paragraphStyle(b.muted, at, b.colour)}
              link={ctx.styles?.link ?? ctx.accent}
            />
          </Section>
        )
      }
      const paragraphs = filled
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
      if (paragraphs.length === 0) return null
      const plain = !b.muted && !b.colour && at !== 'right'
      return (
        <Section className="k-pad" style={BLOCK_PAD}>
          {paragraphs.map((p, i) =>
            plain ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of one fixed text
              <Body key={i} align={at === 'left' ? 'left' : 'center'}>
                {p}
              </Body>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of one fixed text
              <Text key={i} style={paragraphStyle(b.muted, at, b.colour)}>
                {p}
              </Text>
            ),
          )}
        </Section>
      )
    }
    case 'image': {
      const src = imageSrc(b.src, ctx.brand)
      if (!src) return null
      const href = filledLink(b.href, d)
      const img = (
        <Img
          src={src}
          alt={fillVariables(b.alt, d)}
          width={Math.round((contentWidth(ctx.styles) * b.width) / 100)}
          style={{
            margin: align === 'left' ? '0' : align === 'right' ? '0 0 0 auto' : '0 auto',
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
      )
      return (
        <Section className="k-pad" style={{ ...BLOCK_PAD, textAlign: align ?? 'center' }}>
          {href ? <Link href={href}>{img}</Link> : img}
        </Section>
      )
    }
    case 'button': {
      const href = filledLink(b.url, d)
      const label = fill(b.label)
      if (!href || !label) return null
      return (
        <PrimaryButton href={href} look={buttonLook(ctx.styles?.button, b.style, align)}>
          {label}
        </PrimaryButton>
      )
    }
    case 'divider': {
      const label = fill(b.label)
      if (label) return <DividerLabel>{label}</DividerLabel>
      return (
        <Section className="k-pad" style={{ padding: '28px 48px 0' }}>
          <div
            style={{
              borderTop: `1px solid ${b.colour ?? theme.border}`,
              fontSize: '1px',
              lineHeight: '1px',
            }}
          >
            &nbsp;
          </div>
        </Section>
      )
    }
    case 'spacer':
      return (
        <Section style={{ height: SPACER[b.size], lineHeight: SPACER[b.size], fontSize: '1px' }}>
          &nbsp;
        </Section>
      )
    case 'social':
      return (
        <Section className="k-pad" style={{ ...BLOCK_PAD, textAlign: align ?? 'center' }}>
          <SocialRow brand={ctx.brand} />
        </Section>
      )
    case 'help':
      return (
        <HelpBox
          brand={ctx.brand}
          labels={ctx.labels}
          title={fill(b.title) || undefined}
          body={fill(b.body) || undefined}
          whatsapp={b.whatsapp !== false}
        />
      )
    case 'footer': {
      const links = (b.links ?? []).flatMap((l) => {
        const url = filledLink(l.url, d)
        const label = fill(l.label)
        return url && label ? [{ label, url }] : []
      })
      return (
        <EmailFooter
          brand={ctx.brand}
          storeAddress={ctx.storeAddress}
          footerNote={fill(b.note) || ctx.footerNote}
          showSocial={b.social}
          labels={ctx.labels}
          links={links}
          showAddress={b.address !== false}
        />
      )
    }
    default:
      return <MoreBlockView block={b} ctx={ctx} />
  }
}
