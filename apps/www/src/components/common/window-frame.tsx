import { cn } from '@commerce/ui/lib/utils'
import Image from 'next/image'

type WindowFrameProps = {
  url?: string
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}

/** A glass browser window around an admin screenshot. */
export default function WindowFrame({
  src,
  alt,
  width,
  height,
  className,
  priority,
}: WindowFrameProps) {
  return (
    <figure
      className={cn('glass-panel overflow-hidden rounded-xl bg-card ring-1 ring-border', className)}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-full"
      />
    </figure>
  )
}
