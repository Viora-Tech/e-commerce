import { Link, Section, Text } from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import type { LayoutLabels } from '../emails/layout'
import { theme } from '../emails/theme'
import type { EmailBrandInfo, TemplateData } from '../types'
import { isSafeImage } from './parse-blocks'
import { type Inline, parseRichText } from './rich-text'
import { type BlockBox, type DesignStyles, SPACE_PX } from './style-types'
import { fillVariables } from './variables'

/** What every merchant block is drawn with: the order's data, the store and the email's styles. */
export type FreeBlockContext = {
  data: TemplateData
  brand?: EmailBrandInfo | undefined
  storeAddress?: string | undefined
  footerNote: string
  labels: LayoutLabels
  styles?: DesignStyles | undefined
  accent: string
}

/** The card's content width in px, for pictures. */
export const contentWidth = (styles: DesignStyles | undefined) => (styles?.width ?? 620) - 96

/** A link after its variables are filled: only http(s) and mailto, never an empty `{{order_url}}`. */
export function filledLink(url: string | undefined, d: TemplateData): string | undefined {
  if (!url) return undefined
  const u = fillVariables(url, d).trim()
  return /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+)$/i.test(u) ? u : undefined
}

/** A store media path (`/media/...`) needs the shop's address to load in an inbox. */
export function imageSrc(src: string, brand: EmailBrandInfo | undefined): string | undefined {
  if (!isSafeImage(src)) return undefined
  if (src.startsWith('https://')) return src
  return brand?.shopUrl ? `${brand.shopUrl.replace(/\/$/, '')}${src}` : undefined
}

/**
 * A block's own box: a background band across the card and extra space above and below.
 * Without a box the block is drawn as it is, so old designs keep their exact HTML.
 */
export function Frame({ box, children }: { box?: BlockBox | undefined; children: ReactNode }) {
  if (!box || (!box.background && !box.top && !box.bottom)) return <>{children}</>
  const top = SPACE_PX[box.top ?? 'none']
  const bottom = SPACE_PX[box.bottom ?? 'none']
  return (
    <Section
      style={{
        backgroundColor: box.background,
        paddingTop: `${top}px`,
        // A coloured band closes with the blocks' own top spacing, so it does not look cut off.
        paddingBottom: `${bottom + (box.background ? 24 : 0)}px`,
      }}
    >
      {children}
    </Section>
  )
}

function InlineView({ nodes, link }: { nodes: Inline[]; link: string }): ReactNode {
  return nodes.map((n, i) => {
    // biome-ignore-start lint/suspicious/noArrayIndexKey: parts of one fixed text
    if (n.t === 'text') return <span key={i}>{n.v}</span>
    if (n.t === 'b')
      return (
        <strong key={i}>
          <InlineView nodes={n.c} link={link} />
        </strong>
      )
    if (n.t === 'i')
      return (
        <em key={i}>
          <InlineView nodes={n.c} link={link} />
        </em>
      )
    return (
      <Link key={i} href={n.href} style={{ color: link, textDecoration: 'underline' }}>
        <InlineView nodes={n.c} link={link} />
      </Link>
    )
    // biome-ignore-end lint/suspicious/noArrayIndexKey: parts of one fixed text
  })
}

/** A rich text block: paragraphs, bold, italic, links and lists, each with inline styles. */
export function RichTextView({
  text,
  style,
  link,
}: {
  text: string
  style: CSSProperties
  link: string
}) {
  const blocks = parseRichText(text)
  const listStyle: CSSProperties = {
    margin: '10px 0 0',
    padding: '0 0 0 22px',
    textAlign: 'left',
    color: style.color,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
  }
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === 'p') {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs of one fixed text
            <Text key={i} style={style}>
              {b.lines.map((line, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lines of one paragraph
                <span key={j}>
                  {j > 0 ? <br /> : null}
                  <InlineView nodes={line} link={link} />
                </span>
              ))}
            </Text>
          )
        }
        const items = b.items.map((item, j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: items of one list
          <li key={j} style={{ margin: '0 0 4px' }}>
            <InlineView nodes={item} link={link} />
          </li>
        ))
        return b.t === 'ul' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: lists of one fixed text
          <ul key={i} style={listStyle}>
            {items}
          </ul>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: lists of one fixed text
          <ol key={i} style={listStyle}>
            {items}
          </ol>
        )
      })}
    </>
  )
}

/** The text style of a paragraph in a merchant's text block. */
export function paragraphStyle(
  muted: boolean,
  align: CSSProperties['textAlign'],
  colour: string | undefined,
): CSSProperties {
  return muted
    ? {
        margin: 0,
        fontSize: '13.5px',
        lineHeight: '20px',
        fontStyle: 'italic',
        color: colour ?? theme.muted,
        textAlign: align,
        whiteSpace: 'pre-line',
      }
    : {
        fontSize: '15px',
        lineHeight: '23px',
        color: colour ?? theme.body,
        margin: '10px 0 0',
        textAlign: align,
        whiteSpace: 'pre-line',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }
}
