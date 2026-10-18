import { cn } from '@commerce/ui/lib/utils'

type AmbientLightProps = { className?: string }

/** A soft grey wash behind a section: decorative, never coloured. */
export default function AmbientLight({ className }: AmbientLightProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute rounded-full bg-white/[0.07] blur-[4.375rem]',
        className,
      )}
    />
  )
}
