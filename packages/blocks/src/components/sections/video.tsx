import type { ReactNode } from 'react'
import { videoEmbedUrl as embedUrl } from '../../video-url'

/** `heading` is a string in storage, a React node while edited on the canvas. */
type Props = {
  heading: ReactNode
  url: string
  poster: { url: string; alt: string }
  empty: string
}

// Port of sections/video.liquid: an embedded or self-hosted video at 16:9.
export default function Video({ heading, url, poster, empty }: Props) {
  const embed = url ? embedUrl(url) : null
  return (
    <div className="video-section page-width">
      {heading ? <h2 className="video-section__heading section-title">{heading}</h2> : null}
      <div className="video-section__frame">
        {!url ? <p className="text-caption">{empty}</p> : null}
        {embed ? (
          <iframe
            src={embed}
            title={typeof heading === 'string' && heading ? heading : 'Video'}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : null}
        {url && !embed ? (
          // biome-ignore lint/a11y/useMediaCaption: merchant videos carry no caption track.
          <video src={url} poster={poster.url || undefined} controls preload="metadata" />
        ) : null}
      </div>
    </div>
  )
}
