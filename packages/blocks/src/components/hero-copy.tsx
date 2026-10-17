import type { ReactNode } from 'react'
import { linkTarget } from '../link'
import { safeHref } from '../slot-types'
import RichCopy from './rich-copy'

/** A button: its label is a string in storage, a React node while edited on the canvas. */
type HeroLink = { label: ReactNode; href: string; newTab?: boolean | undefined }

type HeroCopyProps = {
  eyebrow?: ReactNode
  heading: ReactNode
  text: ReactNode
  /** The solid button; hidden without a label. */
  primary?: HeroLink | undefined
  /** The outline button beside it; hidden without a label. */
  secondary?: HeroLink | undefined
  /** `h1` for a page's first section, `h2` further down. */
  as?: 'h1' | 'h2'
  /** `display` for heroes; `section` (32px heading, 16px text, 48px buttons) inside a page. */
  size?: 'display' | 'section' | undefined
  className?: string | undefined
}

/**
 * The Figma hero copy block (Section / Split, Spotlight, Video hero, Image banner): a small
 * uppercase eyebrow, the display heading, a large muted paragraph, then a solid and an outline
 * button. Alignment and colour come from the section around it.
 */
export default function HeroCopy({
  eyebrow,
  heading,
  text,
  primary,
  secondary,
  as: Heading = 'h1',
  size = 'display',
  className,
}: HeroCopyProps) {
  // Render logic
  const buttons = [
    { link: primary, variant: 'btn--primary' },
    { link: secondary, variant: 'btn--secondary' },
  ].filter((b) => b.link?.label)

  return (
    <div className={`hero-copy hero-copy--${size}${className ? ` ${className}` : ''}`}>
      <div className="hero-copy__heading-block">
        {eyebrow ? <p className="hero-copy__eyebrow">{eyebrow}</p> : null}
        {heading ? <Heading className="hero-copy__heading">{heading}</Heading> : null}
        <RichCopy value={text} className="hero-copy__text" />
      </div>
      {buttons.length > 0 ? (
        <div className="hero-copy__buttons">
          {buttons.map(({ link, variant }) =>
            link ? (
              <a
                key={variant}
                className={`btn ${variant} hero-copy__button`}
                href={safeHref(link.href) ?? '#'}
                {...linkTarget(link)}
              >
                {link.label}
              </a>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  )
}
