// Port of sections/discord-cta.liquid (+ assets/discord-stars.js): full-bleed community invite band with perks and a join button.
import type { CSSProperties } from 'react'
import { linkTarget } from '../../../link'
import type { Image } from '../../../sections/framed'
import { safeHref } from '../../../slot-types'
import Icon, { type IconName } from '../../icon'
import Picture from '../../picture'
import RichCopy from '../../rich-copy'
import DiscordCtaStars from './discord-cta-stars'

type DiscordCtaProps = {
  eyebrow: string
  heading: string
  text: string
  perks: { icon: IconName; title: string; text: string }[]
  buttonLabel: string
  buttonUrl: string
  footnote: string
  ground: 'aurora' | 'ink'
  backgroundImage: Image
  overlay: number
}

const MARK_ICON: IconName = 'discord'

export default function DiscordCta({
  eyebrow,
  heading,
  text,
  perks,
  buttonLabel,
  buttonUrl,
  footnote,
  ground,
  backgroundImage,
  overlay,
}: DiscordCtaProps) {
  // Render logic
  const hasImage = Boolean(backgroundImage?.url)
  const scrim = hasImage ? Math.min(90, Math.max(0, overlay)) / 100 : 0
  const href = safeHref(buttonUrl) ?? '#'

  return (
    <div
      className={`discord-cta discord-cta--${ground}${hasImage ? ' discord-cta--image' : ''} color-scheme--dark`}
      style={{ '--discord-overlay': scrim } as CSSProperties}
    >
      {hasImage ? (
        <>
          <Picture
            image={backgroundImage}
            alt=""
            className="discord-cta__bg"
            fill
            sizes="100vw"
            loading="lazy"
            ariaHidden
          />
          <div className="discord-cta__scrim" aria-hidden="true" />
        </>
      ) : null}
      <DiscordCtaStars />
      <div className="discord-cta__inner page-width">
        <span className="discord-cta__mark" aria-hidden="true">
          <Icon name={MARK_ICON} size={28} />
          <span className="discord-cta__mark-status" />
        </span>
        {eyebrow ? <p className="discord-cta__eyebrow">{eyebrow}</p> : null}
        {heading ? <h2 className="discord-cta__heading h2">{heading}</h2> : null}
        <RichCopy value={text} className="discord-cta__text text-body" />
        {perks?.length ? (
          <ul className="discord-cta__perks">
            {perks.map((perk, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: perks have no id; the editor reorders by position.
              <li key={i} className="discord-cta__perk">
                <span className="discord-cta__perk-icon" aria-hidden="true">
                  <Icon name={perk.icon} size={20} />
                </span>
                {perk.title ? <span className="discord-cta__perk-title">{perk.title}</span> : null}
                {perk.text ? <span className="discord-cta__perk-text">{perk.text}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {buttonLabel ? (
          <a
            className="btn btn--primary discord-cta__btn"
            href={href}
            {...linkTarget({ newTab: true })}
          >
            <span>{buttonLabel}</span>
          </a>
        ) : null}
        {footnote ? <p className="discord-cta__footnote text-caption">{footnote}</p> : null}
      </div>
    </div>
  )
}
