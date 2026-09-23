type Props = { heading: string; url: string; poster: { url: string; alt: string }; empty: string }

/** YouTube and Vimeo links become privacy-friendly embeds; anything else plays as a file. */
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

// Port of sections/video.liquid: an embedded or self-hosted video at 16:9.
export default function Video({ heading, url, poster, empty }: Props) {
  const embed = url ? embedUrl(url) : null
  return (
    <div className="video-section page-width">
      {heading ? <h2 className="video-section__heading h2">{heading}</h2> : null}
      <div className="video-section__frame">
        {!url ? <p className="text-caption">{empty}</p> : null}
        {embed ? (
          <iframe
            src={embed}
            title={heading || 'Video'}
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
