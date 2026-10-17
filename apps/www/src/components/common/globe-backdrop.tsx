import { cn } from '@commerce/ui/lib/utils'
import Image from 'next/image'

type GlobeBackdropProps = { className?: string; alt?: string }

/** The dotted globe rising from the bottom edge of a section, faded into the page. */
export default function GlobeBackdrop({ className, alt = '' }: GlobeBackdropProps) {
  return (
    <div
      aria-hidden={alt === '' ? true : undefined}
      className={cn('pointer-events-none relative h-60 overflow-hidden md:h-[28rem]', className)}
    >
      <Image
        src="/images/globe.png"
        alt={alt}
        width={1056}
        height={480}
        className="absolute bottom-0 left-1/2 w-[130%] max-w-none -translate-x-1/2 md:w-[66rem]"
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}
