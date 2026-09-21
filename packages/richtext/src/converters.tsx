import type { CSSProperties } from 'react'
import { renderText } from './render-text'
import { isYouTubeId, sanitizeCssValue, sanitizeHref, sanitizeImageSrc } from './sanitize'
import type { ConverterRegistry, SerializedNode } from './types'

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
const ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify', 'start', 'end'])
const ALIGN_BY_NUMBER: Record<number, string> = {
  1: 'left',
  2: 'center',
  3: 'right',
  4: 'justify',
  5: 'start',
  6: 'end',
}
/** Nodes that cannot legally sit inside a <p>. */
const BLOCK_CHILD_TYPES = new Set(['image', 'youtube'])

function elementAlign(format?: number | string): string | undefined {
  if (!format) return undefined
  if (typeof format === 'string') return ALIGN_VALUES.has(format) ? format : undefined
  return ALIGN_BY_NUMBER[format]
}

function elementStyle(node: SerializedNode): CSSProperties | undefined {
  const align = elementAlign(node.format)
  const indent = typeof node.indent === 'number' && node.indent > 0 ? node.indent : 0
  if (!align && !indent) return undefined
  return {
    ...(align ? { textAlign: align as CSSProperties['textAlign'] } : {}),
    ...(indent ? { paddingInlineStart: `${indent * 2}rem` } : {}),
  }
}

function linkProps(node: SerializedNode) {
  const url = sanitizeHref(typeof node.url === 'string' ? node.url : '')
  const newTab = node.target === '_blank'
  return { href: url, ...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }
}

function textOf(node: SerializedNode | undefined): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  return (node.children ?? []).map(textOf).join('')
}

/** Converters for every node type the editor can produce. */
export const defaultConverters: ConverterRegistry = {
  root: ({ node, renderChildren }) => <>{renderChildren(node.children)}</>,

  paragraph: ({ node, renderChildren }) => {
    const children = renderChildren(node.children)
    if (node.children?.some((c) => BLOCK_CHILD_TYPES.has(c.type))) {
      return <div style={elementStyle(node)}>{children}</div>
    }
    // An empty paragraph is a blank line; <br> keeps its height.
    return <p style={elementStyle(node)}>{children ?? <br />}</p>
  },

  heading: ({ node, renderChildren }) => {
    const Tag = (
      typeof node.tag === 'string' && HEADING_TAGS.has(node.tag) ? node.tag : 'h2'
    ) as 'h2'
    return <Tag style={elementStyle(node)}>{renderChildren(node.children)}</Tag>
  },

  quote: ({ node, renderChildren }) => (
    <blockquote style={elementStyle(node)}>{renderChildren(node.children)}</blockquote>
  ),

  text: ({ node }) =>
    renderText(
      typeof node.text === 'string' ? node.text : '',
      typeof node.format === 'number' ? node.format : 0,
    ),

  linebreak: () => <br />,

  tab: () => <span style={{ whiteSpace: 'pre' }}>{'\t'}</span>,

  link: ({ node, renderChildren }) => <a {...linkProps(node)}>{renderChildren(node.children)}</a>,

  autolink: ({ node, renderChildren }) => (
    <a {...linkProps(node)}>{renderChildren(node.children)}</a>
  ),

  list: ({ node, renderChildren }) => {
    const Tag = node.listType === 'number' ? 'ol' : 'ul'
    const start =
      Tag === 'ol' && typeof node.start === 'number' && node.start !== 1 ? node.start : undefined
    const className = node.listType === 'check' ? 'richtext-checklist' : undefined
    return (
      <Tag start={start} className={className} style={elementStyle(node)}>
        {renderChildren(node.children)}
      </Tag>
    )
  },

  listitem: ({ node, renderChildren }) => {
    if (typeof node.checked === 'boolean') {
      return (
        <li
          data-checked={node.checked ? 'true' : 'false'}
          className={node.checked ? 'richtext-check richtext-check--done' : 'richtext-check'}
          style={elementStyle(node)}
        >
          <input type="checkbox" checked={node.checked} readOnly tabIndex={-1} />
          {renderChildren(node.children)}
        </li>
      )
    }
    // Lexical nests a sub-list as a child listitem's only child.
    const nested = node.children?.filter((c) => c.type === 'list')
    if (nested?.length) {
      const inline = node.children?.filter((c) => c.type !== 'list')
      return (
        <li className="richtext-nested" style={elementStyle(node)}>
          {renderChildren(inline)}
          {renderChildren(nested)}
        </li>
      )
    }
    return (
      <li
        style={elementStyle(node)}
        value={typeof node.value === 'number' ? node.value : undefined}
      >
        {renderChildren(node.children)}
      </li>
    )
  },

  horizontalrule: () => <hr />,

  table: ({ node, renderChildren }) => (
    <div className="richtext-table-wrap">
      <table className="richtext-table">
        <tbody>{renderChildren(node.children)}</tbody>
      </table>
    </div>
  ),

  tablerow: ({ node, renderChildren }) => <tr>{renderChildren(node.children)}</tr>,

  tablecell: ({ node, renderChildren }) => {
    const Tag = typeof node.headerState === 'number' && node.headerState > 0 ? 'th' : 'td'
    const colSpan = typeof node.colSpan === 'number' && node.colSpan > 1 ? node.colSpan : undefined
    const rowSpan = typeof node.rowSpan === 'number' && node.rowSpan > 1 ? node.rowSpan : undefined
    const backgroundColor = sanitizeCssValue(
      typeof node.backgroundColor === 'string' ? node.backgroundColor : '',
    )
    return (
      <Tag
        colSpan={colSpan}
        rowSpan={rowSpan}
        style={backgroundColor ? { backgroundColor } : undefined}
      >
        {renderChildren(node.children)}
      </Tag>
    )
  },

  code: ({ node, renderChildren }) => (
    <pre
      style={elementStyle(node)}
      data-language={typeof node.language === 'string' ? node.language : undefined}
    >
      <code>{renderChildren(node.children)}</code>
    </pre>
  ),

  'code-highlight': ({ node }) => {
    const text = typeof node.text === 'string' ? node.text : ''
    const kind =
      typeof node.highlightType === 'string' && /^[a-zA-Z0-9-]+$/.test(node.highlightType)
        ? node.highlightType
        : null
    return kind ? <span className={`richtext-token-${kind}`}>{text}</span> : text
  },

  mark: ({ node, renderChildren }) => <mark>{renderChildren(node.children)}</mark>,

  image: ({ node }) => {
    const src = sanitizeImageSrc(typeof node.src === 'string' ? node.src : '')
    if (!src) return null
    const alt = typeof node.altText === 'string' ? node.altText : ''
    const width = typeof node.width === 'number' ? node.width : undefined
    return (
      <figure className="richtext-figure">
        <img src={src} alt={alt} width={width} loading="lazy" decoding="async" />
        {node.showCaption && alt ? <figcaption>{alt}</figcaption> : null}
      </figure>
    )
  },

  youtube: ({ node }) => {
    if (!isYouTubeId(node.videoID)) return null
    return (
      <div className="richtext-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${node.videoID}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title="YouTube video"
        />
      </div>
    )
  },

  'collapsible-container': ({ node, renderChildren }) => {
    const title = node.children?.find((c) => c.type === 'collapsible-title')
    const content = node.children?.find((c) => c.type === 'collapsible-content')
    return (
      <details className="richtext-details" open={node.open === true}>
        <summary>{textOf(title) || 'Details'}</summary>
        <div>{renderChildren(content?.children)}</div>
      </details>
    )
  },
  'collapsible-title': () => null,
  'collapsible-content': () => null,
}
