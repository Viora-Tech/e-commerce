import { cn } from '@commerce/ui/lib/utils'

type AmbientLightProps = { className?: string }

/** A soft grey wash behind a section: decorative, never coloured. */
export default function AmbientLight({ className }: AmbientLightProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute rounded-full bg-foreground/5 blur-3xl',
        className,
      )}
    />
  )
}
