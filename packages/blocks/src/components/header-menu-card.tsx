import type { MenuCard } from '../header-menu'
import { cx, safeHref } from '../slot-types'
import Icon from './icon'
import Picture from './picture'

type HeaderMenuCardProps = {
  card: MenuCard
  /**
   * Draw the photo. Off until the dropdown is first opened (`header-nav.tsx`): a closed panel is
   * only `visibility: hidden`, and the browser fetched every card photo on every page view,
   * `loading="lazy"` or not. The empty media box is the card's own tone until then.
   */
  media?: boolean | undefined
}

/**
 * One card in a dropdown's right-hand zone (header.liquid's `header__expansion-card`): a
 * photo card, or with no image a text card (eyebrow and label on a solid tile).
 */
export default function HeaderMenuCard({ card, media = true }: HeaderMenuCardProps) {
  // Early returns
  const href = safeHref(card.href)
  if (!href) return null

  // Render logic
  return (
    <a
      href={href}
      className={cx(
        'header__expansion-card',
        `header__expansion-card--${card.tone}`,
        !card.image && 'header__expansion-card--text',
      )}
    >
      {card.image ? (
        <span className="header__expansion-card-media">
          {media ? (
            <Picture
              image={card.image}
              alt={card.image.alt}
              width={800}
              height={640}
              sizes="(min-width: 990px) 27vw, 400px"
            />
          ) : null}
        </span>
      ) : null}
      {card.eyebrow ? <span className="header__expansion-card-eyebrow">{card.eyebrow}</span> : null}
      <span className="header__expansion-card-title">{card.title}</span>
      <Icon name="arrow" size={20} />
    </a>
  )
}
