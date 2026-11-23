import { Column, Img, Link, Row, Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import { Coupon } from '../emails/blocks/codes'
import { BLOCK_PAD } from '../emails/blocks/tokens'
import { Body, PrimaryButton } from '../emails/components'
import { theme } from '../emails/theme'
import {
  contentWidth,
  type FreeBlockContext,
  filledLink,
  imageSrc,
  paragraphStyle,
  RichTextView,
} from './free-parts'
import { sanitizeEmailHtml } from './sanitize-html'
import { buttonLook } from './slot-edit'
import { BUTTON_RADIUS } from './style-types'
import type { CellBlock, FreeBlock } from './types'
import { VAR } from './variable-syntax'
import { fillVariables } from './variables'

/** The newer blocks (version 2): hero, products, coupon, video, HTML and columns. */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** HTML with its variables filled (each value escaped), then cleaned once more. */
export function filledHtml(html: string, ctx: FreeBlockContext): string {
  const filled = html.replace(VAR, (whole) => escapeHtml(fillVariables(whole, ctx.data)))
  return sanitizeEmailHtml(filled)
}

const cellPad: CSSProperties = { margin: '0 0 12px' }

/** A block inside a column: the same look as a full-width one, without the card's side space. */
function Cell({
  block: b,
  ctx,
  width,
}: {
  block: CellBlock
  ctx: FreeBlockContext
  width: number
}) {
  const d = ctx.data
  const align = b.box?.align ?? 'left'
  switch (b.type) {
    case 'heading': {
      const text = fillVariables(b.text, d).trim()
      if (!text) return null
      return (
        <Text
          style={{
            ...cellPad,
            fontSize: b.size === 'large' ? '24px' : '18px',
            lineHeight: b.size === 'large' ? '30px' : '24px',
            color: b.colour ?? theme.ink,
            textAlign: align,
          }}
        >
          {text}
        </Text>
      )
    }
    case 'text': {
      const text = fillVariables(b.text, d)
      if (!text.trim()) return null
      const style = {
        ...paragraphStyle(b.muted, b.box?.align ?? b.align, b.colour),
        margin: '0 0 12px',
      }
      return b.rich ? (
        <RichTextView text={text} style={style} link={ctx.styles?.link ?? ctx.accent} />
      ) : (
        <Text style={style}>{text.trim()}</Text>
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
          width={Math.round((width * b.width) / 100)}
          style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 0 12px' }}
        />
      )
      return href ? <Link href={href}>{img}</Link> : img
    }
    case 'button': {
      const href = filledLink(b.url, d)
      const label = fillVariables(b.label, d).trim()
      if (!href || !label) return null
      const look = buttonLook(ctx.styles?.button, b.style)
      return (
        <Text style={{ ...cellPad, textAlign: align }}>
          <Link
            href={href}
            style={{
              display: look?.full ? 'block' : 'inline-block',
              padding: '10px 20px',
              backgroundColor: look?.background ?? theme.button,
              color: look?.text ?? theme.onButton,
              borderRadius: look?.radius ?? '4px',
              fontSize: '15px',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            {label}
          </Link>
        </Text>
      )
    }
    case 'spacer':
      return (
        <div
          style={{ height: b.size === 'small' ? '8px' : b.size === 'large' ? '32px' : '18px' }}
        />
      )
  }
}

export function MoreBlockView({ block: b, ctx }: { block: FreeBlock; ctx: FreeBlockContext }) {
  const d = ctx.data
  const fill = (t: string) => fillVariables(t, d).trim()
  const inner = contentWidth(ctx.styles)
  switch (b.type) {
    case 'hero': {
      const src = imageSrc(b.src, ctx.brand)
      const href = filledLink(b.href, d)
      const buttonHref = filledLink(b.buttonUrl, d)
      const img = src ? (
        <Img
          src={src}
          alt={fill(b.alt)}
          width={ctx.styles?.width ?? 620}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      ) : null
      return (
        <>
          {img ? <Section>{href ? <Link href={href}>{img}</Link> : img}</Section> : null}
          {fill(b.heading) || fill(b.text) ? (
            <Section
              className="k-pad"
              style={{ ...BLOCK_PAD, textAlign: b.box?.align ?? 'center' }}
            >
              {fill(b.heading) ? (
                <Text
                  className="k-title"
                  style={{ margin: 0, fontSize: '32px', lineHeight: '38px', color: theme.ink }}
                >
                  {fill(b.heading)}
                </Text>
              ) : null}
              {fill(b.text) ? (
                <Body align={b.box?.align === 'left' ? 'left' : 'center'}>{fill(b.text)}</Body>
              ) : null}
            </Section>
          ) : null}
          {buttonHref && fill(b.buttonLabel) ? (
            <PrimaryButton
              href={buttonHref}
              look={buttonLook(ctx.styles?.button, undefined, b.box?.align)}
            >
              {fill(b.buttonLabel)}
            </PrimaryButton>
          ) : null}
        </>
      )
    }
    case 'products': {
      if (b.items.length === 0) return null
      const shop = ctx.brand?.shopUrl?.replace(/\/$/, '')
      const rows: (typeof b.items)[] = []
      for (let i = 0; i < b.items.length; i += b.columns) rows.push(b.items.slice(i, i + b.columns))
      const tile = Math.floor(inner / b.columns) - 12
      return (
        <Section className="k-pad" style={BLOCK_PAD}>
          {fill(b.title) ? (
            <Text
              style={{
                margin: '0 0 14px',
                fontSize: '20px',
                lineHeight: '26px',
                color: theme.ink,
                textAlign: 'center',
              }}
            >
              {fill(b.title)}
            </Text>
          ) : null}
          {rows.map((row) => (
            <Row key={row.map((p) => p.id).join('-')}>
              {row.map((p) => {
                const url = shop ? `${shop}/products/${p.handle}` : undefined
                const src = p.imageUrl ? imageSrc(p.imageUrl, ctx.brand) : undefined
                const pic = src ? (
                  <Img
                    src={src}
                    alt={p.title}
                    width={tile}
                    style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '6px' }}
                  />
                ) : null
                return (
                  <Column
                    key={p.id}
                    className="k-stack"
                    style={{
                      width: `${Math.floor(100 / b.columns)}%`,
                      padding: '0 6px 16px',
                      verticalAlign: 'top',
                    }}
                  >
                    {pic ? url ? <Link href={url}>{pic}</Link> : pic : null}
                    <Text
                      style={{
                        margin: '8px 0 0',
                        fontSize: '15px',
                        lineHeight: '20px',
                        color: theme.ink,
                      }}
                    >
                      {p.title}
                    </Text>
                    {b.showPrice && p.priceLabel ? (
                      <Text
                        style={{
                          margin: '2px 0 0',
                          fontSize: '14px',
                          lineHeight: '20px',
                          color: theme.body,
                        }}
                      >
                        {p.priceLabel}
                      </Text>
                    ) : null}
                    {url && fill(b.buttonLabel) ? (
                      <Text style={{ margin: '8px 0 0', fontSize: '14px' }}>
                        <Link
                          href={url}
                          style={{
                            display: 'inline-block',
                            padding: '7px 14px',
                            backgroundColor: ctx.styles?.button?.background ?? theme.button,
                            color: ctx.styles?.button?.text ?? theme.onButton,
                            borderRadius: BUTTON_RADIUS[ctx.styles?.button?.shape ?? 'rounded'],
                            textDecoration: 'none',
                          }}
                        >
                          {fill(b.buttonLabel)}
                        </Link>
                      </Text>
                    ) : null}
                  </Column>
                )
              })}
            </Row>
          ))}
        </Section>
      )
    }
    case 'coupon':
      return (
        <Section className="k-pad" style={BLOCK_PAD}>
          <Coupon
            accent={ctx.accent}
            block={{
              kind: 'coupon',
              code: fill(b.code),
              label: fill(b.label),
              note: fill(b.note) || undefined,
              value: fill(b.value) || undefined,
              valueNote: fill(b.valueNote) || undefined,
            }}
          />
        </Section>
      )
    case 'video': {
      const src = imageSrc(b.src, ctx.brand)
      const url = filledLink(b.url, d)
      if (!src || !url) return null
      return (
        <Section className="k-pad" style={{ ...BLOCK_PAD, textAlign: 'center' }}>
          <Link href={url}>
            <Img
              src={src}
              alt={fill(b.alt)}
              width={inner}
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '6px' }}
            />
          </Link>
          <Text style={{ margin: '10px 0 0', fontSize: '15px' }}>
            <Link
              href={url}
              style={{ color: ctx.styles?.link ?? ctx.accent, textDecoration: 'underline' }}
            >
              ▶&nbsp;&nbsp;{fill(b.label) || url}
            </Link>
          </Text>
        </Section>
      )
    }
    case 'html': {
      const html = filledHtml(b.html, ctx)
      if (!html.trim()) return null
      return (
        <Section className="k-pad" style={BLOCK_PAD}>
          <div
            style={{ fontSize: '15px', lineHeight: '23px', color: theme.body }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: cleaned by sanitizeEmailHtml's allow-list on save and again here
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Section>
      )
    }
    case 'columns': {
      const n = b.cells.length
      const gap = b.gap === 'small' ? 12 : 24
      const width = Math.floor((inner - gap * (n - 1)) / n)
      return (
        <Section className="k-pad" style={BLOCK_PAD}>
          <Row>
            {b.cells.map((cell, i) => (
              <Column
                // biome-ignore lint/suspicious/noArrayIndexKey: columns are positions
                key={i}
                className={b.stack ? 'k-stack' : undefined}
                style={{
                  width: `${Math.floor(100 / n)}%`,
                  verticalAlign: b.valign ?? 'top',
                  paddingLeft: i === 0 ? 0 : `${gap / 2}px`,
                  paddingRight: i === n - 1 ? 0 : `${gap / 2}px`,
                }}
              >
                {cell.map((c) => (
                  <Cell key={c.id} block={c} ctx={ctx} width={width} />
                ))}
              </Column>
            ))}
          </Row>
        </Section>
      )
    }
    default:
      return null
  }
}
