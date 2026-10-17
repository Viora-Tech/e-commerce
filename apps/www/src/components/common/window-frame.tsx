import { ShieldCheck_ as ShieldCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Image from 'next/image'

type WindowFrameProps = {
  url: string
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}

/** A glass browser window around an admin screenshot. */
export default function WindowFrame({
  url,
  src,
  alt,
  width,
  height,
  className,
  priority,
}: WindowFrameProps) {
  return (
    <figure
      className={cn(
        'surface-glass overflow-hidden rounded-xl bg-card ring-1 ring-border',
        className,
      )}
    >
      <div className="flex h-9 items-center gap-3 border-b border-border bg-muted/40 px-3">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          <span className="size-2 rounded-full bg-muted-foreground/40" />
        </span>
        <span className="mx-auto flex h-6 max-w-xs flex-1 items-center justify-center gap-1.5 rounded-md bg-background/60 px-3 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3" />
          <span className="truncate">{url}</span>
        </span>
      </div>
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
