import { navigationContent as copy } from '../data/navigation'
import type { MenuCard } from '../header-menu'
import { cx } from '../slot-types'
import type { NavLink } from '../types'
import HeaderMenuCard from './header-menu-card'
import Icon from './icon'

type HeaderMenuPanelProps = {
  link: NavLink
  /** Grouped columns (a three-level menu) rather than a single list of links. */
  columns: boolean
  cards: MenuCard[]
}

/**
 * The content of a full-width dropdown (header.liquid's `header__expansion-content`): the
 * item's links on the left, as grouped columns for a three-level menu, and its cards in the
 * right-hand zone when it has any.
 */
export default function HeaderMenuPanel({ link, columns, cards }: HeaderMenuPanelProps) {
  // Render logic
  const children = link.children ?? []
  const withCards = cards.length > 0

  return (
    <div
      className={cx(
        'header__expansion-inner',
        withCards && 'header__expansion-inner--with-features',
      )}
    >
      <div className="header__expansion-links">
        {columns ? (
          <div className="header__mega-columns">
            {children.map((column) => (
              <div key={column.id} className="header__mega-column">
                <a href={column.href} className="header__mega-heading">
                  {column.label}
                </a>
                {column.children?.length ? (
                  <ul className="header__expansion-sublist">
                    {column.children.map((leaf) => (
                      <li key={leaf.id}>
                        <a href={leaf.href}>{leaf.label}</a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div
            className={cx(
              'header__expansion-links-list',
              children.length > 10 && 'header__expansion-links-list--columns',
            )}
          >
            {children.map((child) => (
              <div key={child.id} className="header__expansion-link-group">
                <a href={child.href} className="header__expansion-link">
                  <span className="header__expansion-link-text">{child.label}</span>
                  <Icon name="chevron-down" size={14} />
                </a>
              </div>
            ))}
          </div>
        )}
        <a href={link.href} className="header__expansion-all">
          <span className="header__expansion-all-text">{copy.viewAll(link.label)}</span>
          <Icon name="arrow" size={16} />
        </a>
      </div>
      {withCards ? (
        <div className="header__expansion-features-zone">
          <div className="header__expansion-features">
            <div className="header__expansion-preview header__expansion-preview--default">
              <div
                className={cx(
                  'header__expansion-cards',
                  cards.length === 1 && 'header__expansion-cards--single',
                  cards.length === 3 && 'header__expansion-cards--triple',
                )}
              >
                {cards.map((card) => (
                  <HeaderMenuCard key={card.key} card={card} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
