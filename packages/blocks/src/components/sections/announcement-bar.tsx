type Props = { text: string; link: { label: string; href: string } }

// Port of sections/announcement-bar.liquid: one message, optionally linked.
export default function AnnouncementBar({ text, link }: Props) {
  if (!text) return null
  return (
    <section className="announcement-bar" aria-label={text}>
      <p className="announcement-bar__message text-small">
        {text}
        {link.label && link.href ? (
          <a className="announcement-bar__link" href={link.href}>
            {link.label}
          </a>
        ) : null}
      </p>
    </section>
  )
}
