import { linkTarget } from '../../link'
import { safeHref } from '../../slot-types'

type Props = { text: string; link: { label: string; href: string; newTab?: boolean } }

// Port of sections/announcement-bar.liquid: one message, optionally linked.
export default function AnnouncementBar({ text, link }: Props) {
  // Early returns
  if (!text) return null

  // Render logic
  const href = safeHref(link.href)

  return (
    <section className="announcement-bar" aria-label={text}>
      <p className="announcement-bar__message text-small">
        {text}
        {link.label && href ? (
          <a className="announcement-bar__link" href={href} {...linkTarget(link)}>
            {link.label}
          </a>
        ) : null}
      </p>
    </section>
  )
}
