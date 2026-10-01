import type { MouseEvent } from 'react'
import { socialWallContent as copy } from '../../../data/glide/social-wall'
import { focalStyle } from '../../../focal-point'
import { linkTarget } from '../../../link'
import { safeHref } from '../../../slot-types'
import Icon from '../../icon'
import Picture from '../../picture'
import type { SocialPost } from './social-wall-types'

/** The platform glyph in a tile's corner. */
const BADGE = { instagram: 'instagram', x: 'twitter', youtube: 'youtube' } as const

type SocialWallTileProps = {
  post: SocialPost
  hidden: boolean
  /** The marquee's second run: kept out of the accessibility tree. */
  duplicate: boolean
  playing: boolean
  onPlay: (event: MouseEvent<HTMLAnchorElement>) => void
}

const youtubeStill = (id: string) =>
  `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
const youtubeLink = (id: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
const youtubeEmbed = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`

// One post tile. A YouTube tile is a plain link to the video until it is played, at which
// point the iframe replaces the link (so no YouTube code or cookie loads before then).
export default function SocialWallTile({
  post,
  hidden,
  duplicate,
  playing,
  onPlay,
}: SocialWallTileProps) {
  // Render logic
  const videoId = post.videoId.trim()
  const isVideo = post.platform === 'youtube' && videoId !== ''
  const link = safeHref(post.link) ?? (isVideo ? youtubeLink(videoId) : null)
  const still = post.image?.url
    ? post.image
    : isVideo
      ? { url: youtubeStill(videoId), alt: '' }
      : null
  const classes = `social-tile social-tile--${post.platform}${isVideo ? ' social-tile--video' : ''}${playing ? ' is-playing' : ''}`
  const watchLabel = isVideo ? copy.watch : copy.viewPost

  return (
    <li
      className={classes}
      data-platform={post.platform}
      hidden={hidden}
      aria-hidden={duplicate ? true : undefined}
    >
      {playing ? (
        <iframe
          className="social-tile__iframe"
          src={youtubeEmbed(videoId)}
          title={copy.youtubeTitleFallback}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <a
          className="social-tile__link"
          href={link ?? '#'}
          {...(link ? linkTarget({ newTab: true }) : {})}
          onClick={isVideo ? onPlay : undefined}
        >
          <span className="social-tile__media">
            {still ? (
              <Picture
                image={still}
                alt=""
                className="social-tile__image"
                style={focalStyle(post.image?.focal)}
                fill
                sizes="(min-width: 990px) 25vw, 50vw"
                loading="lazy"
              />
            ) : null}
          </span>
          <span className="social-tile__badge" aria-hidden="true">
            <Icon name={BADGE[post.platform]} size={16} />
          </span>
          {isVideo ? (
            <span className="social-tile__play" aria-hidden="true">
              <svg role="presentation" viewBox="0 0 24 24" width="22" height="22" focusable="false">
                <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
              </svg>
            </span>
          ) : null}
          {post.caption ? <span className="social-tile__caption">{post.caption}</span> : null}
          <span className="visually-hidden">{watchLabel}</span>
        </a>
      )}
    </li>
  )
}
