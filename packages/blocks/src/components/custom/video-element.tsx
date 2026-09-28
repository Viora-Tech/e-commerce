import { customSectionsContent as copy } from '../../data/custom-sections'
import { safeVideoFile, videoEmbedUrl } from '../../video-url'
import ElementBox from './element-box'

export type VideoElementProps = {
  url: string
  poster: { url: string; alt: string }
  title: string
  style: unknown
}

/**
 * A YouTube or Vimeo video (privacy-friendly embed, sandboxed) or a video
 * file, in a 16:9 box reserved before it loads.
 */
export default function VideoElement({ url, poster, title, style }: VideoElementProps) {
  // Render logic
  const embed = url ? videoEmbedUrl(url) : null
  const file = url && !embed ? safeVideoFile(url) : null

  return (
    <ElementBox look={style} className="custom-video w-full">
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-surface)]">
        {embed ? (
          <iframe
            src={embed}
            title={title || copy.labels.VideoPlayer}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full border-0"
          />
        ) : null}
        {file ? (
          // biome-ignore lint/a11y/useMediaCaption: merchant videos carry no caption track.
          <video
            src={file}
            poster={poster?.url || undefined}
            controls
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        {!embed && !file ? (
          <p className="absolute inset-0 m-0 flex items-center justify-center text-sm text-[var(--color-muted)]">
            {copy.empty.video}
          </p>
        ) : null}
      </div>
    </ElementBox>
  )
}
