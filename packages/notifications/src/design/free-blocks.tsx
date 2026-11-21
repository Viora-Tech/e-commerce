import { Img, Link, Section, Text } from '@react-email/components'
import { BLOCK_PAD } from '../emails/blocks/tokens'
import { Body, DividerLabel, PrimaryButton } from '../emails/components'
import { EmailFooter, SocialRow } from '../emails/footer'
import { EmailHeader } from '../emails/header'
import { HelpBox } from '../emails/help-box'
import type { LayoutLabels } from '../emails/layout'
import { theme } from '../emails/theme'
import type { EmailBrandInfo, TemplateData } from '../types'
import { isSafeImage } from './parse'
import type { FreeBlock } from './types'
import { fillVariables } from './variables'

export type FreeBlockContext = {
  data: TemplateData
  brand?: EmailBrandInfo | undefined
  storeAddress?: string | undefined
  footerNote: string
  labels: LayoutLabels
}

const SPACER = { small: '12px', medium: '28px', large: '48px' } as const

/** A link after its variables are filled: only http(s) and mailto, never an empty `{{order_url}}`. */
function filledLink(url: string | undefined, d: TemplateData): string | undefined {
  if (!url) return undefined
  const u = fillVariables(url, d).trim()
  return /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+)$/i.test(u) ? u : undefined
}

/** A store media path (`/media/...`) needs the shop's address to load in an inbox. */
function imageSrc(src: string, brand: EmailBrandInfo | undefined): string | undefined {
  if (!isSafeImage(src)) return undefined
  if (src.startsWith('https://')) return src
  return brand?.shopUrl ? `${brand.shopUrl.replace(/\/$/, '')}${src}` : undefined
}

/** One block a merchant placed in their design, drawn with the built-in email's styles. */
export function FreeBlockView({ block: b, ctx }: { block: FreeBlock; ctx: FreeBlockContext }) {
  const d = ctx.data
  switch (b.type) {
    case 'logo':
      return (
        <EmailHeader storeName={d.storeName} brand={ctx.brand} menu={b.menu} labels={ctx.labels} />
      )
    case 'heading': {
      const text = fillVariables(b.text, d).trim()
      if (!text) return null
      const large = b.size === 'large'
      return (
        <Section className="k-pad" style={{ ...BLOCK_PAD, textAlign: 'center' }}>
          <Text
            className={large ? 'k-title' : undefined}
            style={{
              margin: 0,
              fontSize: large ? '34px' : '22px',
              lineHeight: large ? '40px' : '28px',
              fontWeight: 400,
              color: theme.ink,
            }}
          >
            {text}
          </Text>
        </Section>
      )
    }
    case 'text': {
      const paragraphs = fillVariables(b.text, d)
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
      if (paragraphs.length === 0) return null
      return (
        <Section className="k-pad" style={BLOCK_PAD}>
          {paragraphs.map((p, i) =>
            b.muted ? (
              <Text
                // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of one fixed text
                key={i}
                style={{
                  margin: 0,
                  fontSize: '13.5px',
                  lineHeight: '20px',
                  fontStyle: 'italic',
                  color: theme.muted,
                  textAlign: b.align,
                  whiteSpace: 'pre-line',
                }}
              >
                {p}
              </Text>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of one fixed text
              <Body key={i} align={b.align}>
                {p}
              </Body>
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
          width={Math.round((524 * b.width) / 100)}
          style={{ margin: '0 auto', maxWidth: '100%', height: 'auto', display: 'block' }}
        />
      )
      return (
        <Section className="k-pad" style={{ ...BLOCK_PAD, textAlign: 'center' }}>
          {href ? <Link href={href}>{img}</Link> : img}
        </Section>
      )
    }
    case 'button': {
      const href = filledLink(b.url, d)
      const label = fillVariables(b.label, d).trim()
      return href && label ? <PrimaryButton href={href}>{label}</PrimaryButton> : null
    }
    case 'divider': {
      const label = fillVariables(b.label, d).trim()
      if (label) return <DividerLabel>{label}</DividerLabel>
      return (
        <Section className="k-pad" style={{ padding: '28px 48px 0' }}>
          <div
            style={{ borderTop: `1px solid ${theme.border}`, fontSize: '1px', lineHeight: '1px' }}
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
        <Section className="k-pad" style={{ ...BLOCK_PAD, textAlign: 'center' }}>
          <SocialRow brand={ctx.brand} />
        </Section>
      )
    case 'help':
      return <HelpBox brand={ctx.brand} labels={ctx.labels} />
    case 'footer':
      return (
        <EmailFooter
          brand={ctx.brand}
          storeAddress={ctx.storeAddress}
          footerNote={ctx.footerNote}
          showSocial={b.social}
          labels={ctx.labels}
        />
      )
  }
}
