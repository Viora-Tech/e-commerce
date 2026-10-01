import { footerContent as copy } from '../data/glide/footer'
import type { SocialPlatform } from '../sections/glide/footer'
import { safeHref } from '../slot-types'
import Icon from './icon'

type SocialLinksProps = {
  links: { platform: SocialPlatform; url: string }[]
}

const label = (platform: SocialPlatform) =>
  copy.socialOptions.find((o) => o.value === platform)?.label ?? platform

// Port of snippets/social-links.liquid: one round icon per network that has a link.
export default function SocialLinks({ links }: SocialLinksProps) {
  // Render logic
  const shown = links.flatMap((l) => {
    const href = safeHref(l.url)
    return href ? [{ platform: l.platform, href }] : []
  })

  return shown.length > 0 ? (
    <div className="footer__social">
      {shown.map((l) => (
        <a
          key={`${l.platform}:${l.href}`}
          href={l.href}
          className="footer__social-link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label(l.platform)}
        >
          <Icon name={l.platform} size={20} />
        </a>
      ))}
    </div>
  ) : null
}
