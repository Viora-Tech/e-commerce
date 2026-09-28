import type { CSSProperties } from 'react'
import { type ColourChoice, colourValue, rem } from '../../element-style'
import { focalStyle } from '../../focal-point'
import { linkTarget } from '../../link'
import { asSlot, cx, safeHref } from '../../slot-types'
import ElementBox from './element-box'

export type GroupProps = {
  direction: 'row' | 'column'
  gap: number
  align: 'start' | 'center' | 'end' | 'stretch'
  justify: 'start' | 'center' | 'end' | 'between'
  wrap: boolean
  padding: number
  background: ColourChoice
  backgroundImage: { url: string; alt: string; focal?: { x: number; y: number } | undefined }
  radius: number
  border: boolean
  maxWidth: number
  minHeight: number
  fullBleed: boolean
  link: { label: string; href: string; newTab?: boolean | undefined }
  content: unknown
  style: unknown
  editing?: boolean | undefined
}

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }
const JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
}

/**
 * A flex container merchants fill with any blocks (Framer's stack, Webflow's
 * div block). Row groups wrap onto the next line on narrow screens when
 * "wrap" is on; "link the whole group" lays a stretched link under the
 * content, so buttons inside still work (it is left out while editing, where
 * a click selects).
 */
export default function GroupBlock({
  direction,
  gap,
  align,
  justify,
  wrap,
  padding,
  background,
  backgroundImage,
  radius,
  border,
  maxWidth,
  minHeight,
  fullBleed,
  link,
  content,
  style,
  editing,
}: GroupProps) {
  // Render logic
  const Content = asSlot(content)
  const href = safeHref(link?.href)
  const image = backgroundImage?.url ? backgroundImage : null
  const frame: CSSProperties = {
    backgroundColor: colourValue(background) ?? undefined,
    borderRadius: rem(radius, 64) ?? undefined,
    border: border ? '1px solid var(--color-line)' : undefined,
    maxWidth: fullBleed ? undefined : (rem(maxWidth, 2400) ?? 'var(--page-width, 80rem)'),
    marginInline: fullBleed ? undefined : 'auto',
    minHeight: rem(minHeight, 2400) ?? undefined,
    padding: rem(padding, 200) ?? undefined,
  }
  const layout: CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'row' ? 'row' : 'column',
    flexWrap: wrap ? 'wrap' : 'nowrap',
    gap: rem(gap, 200) ?? undefined,
    alignItems: ALIGN[align] ?? undefined,
    justifyContent: JUSTIFY[justify] ?? undefined,
  }

  return (
    <ElementBox look={style} className={cx('custom-group relative isolate w-full')}>
      <div
        className={cx('relative isolate h-full', (image || radius > 0) && 'overflow-hidden')}
        style={frame}
      >
        {image ? (
          <img
            src={image.url}
            alt={image.alt ?? ''}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover"
            style={focalStyle(image.focal)}
          />
        ) : null}
        {href && !editing ? (
          <a
            href={href}
            aria-label={link.label || undefined}
            className="absolute inset-0 z-[1]"
            {...linkTarget(link)}
          >
            <span className="sr-only">{link.label}</span>
          </a>
        ) : null}
        <Content
          className={cx(
            'relative min-w-0',
            href && '[&_a]:relative [&_a]:z-[2] [&_button]:relative [&_button]:z-[2]',
          )}
          style={layout}
          minEmptyHeight={96}
        />
      </div>
    </ElementBox>
  )
}
