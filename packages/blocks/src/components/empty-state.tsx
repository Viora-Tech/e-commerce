import type { ReactNode } from 'react'
import Icon, { type IconName } from './icon'

type EmptyStateProps = {
  icon?: IconName | undefined
  title: ReactNode
  body?: ReactNode
  /** The way on, usually a solid button link. */
  action?: { label: ReactNode; href: string } | undefined
  /** Anything under the text (a search field on the 404 page). */
  children?: ReactNode
}

/**
 * Figma Store / Empty state (693:80908): a small icon tile, a bold title, one muted line and a
 * button, centred. The empty cart, empty wishlist, no search results and the 404 page use it.
 */
export default function EmptyState({ icon, title, body, action, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="empty-state__icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <p className="empty-state__title">{title}</p>
      {body ? <p className="empty-state__body">{body}</p> : null}
      {children}
      {action ? (
        <a href={action.href} className="btn btn--primary empty-state__action">
          {action.label}
        </a>
      ) : null}
    </div>
  )
}
