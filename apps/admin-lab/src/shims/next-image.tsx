/** SPIKE shim for `next/image`: a plain lazy <img> (no optimiser; the admin's images are CDN URLs). */
import type { ImgHTMLAttributes } from 'react'

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string | { src: string }
  fill?: boolean
  priority?: boolean
  quality?: number
  unoptimized?: boolean
  placeholder?: string
}

export default function Image({
  src,
  fill,
  priority,
  quality: _q,
  unoptimized: _u,
  placeholder: _p,
  style,
  alt,
  ...rest
}: Props) {
  return (
    <img
      src={typeof src === 'string' ? src : (src as { src: string }).src}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      alt={alt ?? ''}
      style={
        fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style
      }
      {...rest}
    />
  )
}
