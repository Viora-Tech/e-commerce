import type { ReactNode } from 'react'
import { announcementBarContent as copy } from '../../data/zero-drift/announcement-bar'
import Marquee from '../../effects/marquee'
import { cx, safeHref } from '../../slot-types'
import Icon from '../icon'
import RichCopy from '../rich-copy'
import AnnouncementRotator from './announcement-rotator'

type SocialPlatform = keyof typeof copy.social

type AnnouncementBarProps = {
  /** `text` is richtext HTML on the storefront, Puck's inline editor (a node) on the canvas. */
  announcements: { text: ReactNode; link: string }[]
  displayMode: 'rotate' | 'marquee'
  autorotate: boolean
  autorotateSpeed: number
  marqueeSpeed: number
  /** Already filtered by the section's "show social" switch. */
  socials: { platform: string; url: string }[]
  scheme: string
}

const isPlatform = (value: string): value is SocialPlatform => value in copy.social

// Port of sections/announcement-bar.liquid: rotating or scrolling messages, socials on the left.
export default function AnnouncementBar({
  announcements,
  displayMode,
  autorotate,
  autorotateSpeed,
  marqueeSpeed,
  socials,
  scheme,
}: AnnouncementBarProps) {
  // Early returns
  if (announcements.length === 0) return null

  // Render logic
  const links = socials.flatMap((s) => {
    const href = safeHref(s.url)
    return href && isPlatform(s.platform) ? [{ platform: s.platform, href }] : []
  })
  const items = announcements.map((a, i) => ({
    key: String(i),
    node: <Message text={a.text} link={a.link} />,
  }))

  return (
    <section
      className={cx(
        'announcement-bar',
        `announcement-bar--${displayMode}`,
        scheme && scheme !== 'scheme-1' && `color-${scheme}`,
      )}
      aria-label={copy.region}
    >
      <div className="announcement-bar__inner page-width">
        {links.length > 0 ? (
          <div className="announcement-bar__social only-desktop">
            {links.map((l) => (
              <a
                key={l.platform}
                href={l.href}
                className="announcement-bar__social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={copy.social[l.platform]}
              >
                <Icon name={l.platform} size={16} />
              </a>
            ))}
          </div>
        ) : null}
        {displayMode === 'marquee' ? (
          <Marquee
            pauseOnHover
            durationSeconds={marqueeSpeed}
            gapRem={0}
            className="announcement-bar__marquee"
            groupClassName="announcement-bar__marquee-run"
          >
            {items.map((item) => (
              <div key={item.key} className="announcement-bar__marquee-item">
                {item.node}
              </div>
            ))}
          </Marquee>
        ) : (
          <AnnouncementRotator
            items={items}
            autorotate={autorotate}
            intervalSeconds={autorotateSpeed}
          />
        )}
      </div>
    </section>
  )
}

/** A message with its trailing arrow when it links somewhere, as the theme draws both modes. */
function Message({ text, link }: { text: ReactNode; link: string }) {
  const href = safeHref(link)
  return href ? (
    <a href={href} className="announcement-bar__link">
      <RichCopy value={text} className="announcement-bar__copy" />
      <Icon name="arrow" size={12} />
    </a>
  ) : (
    <RichCopy value={text} className="announcement-bar__text" />
  )
}
