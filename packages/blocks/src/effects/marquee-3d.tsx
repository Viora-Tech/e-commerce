// Adapted from Magic UI's 3D Marquee demo (MIT), https://magicui.design/docs/components/marquee
// ("3D" example, registry item `marquee-3d`). See THIRD_PARTY_NOTICES.md and
// packages/blocks/THIRD_PARTY_LICENSES.md.
// Same composition: four vertical Marquees (forward, reverse, reverse, forward) on one plane
// tilted by translateX/translateZ and rotateX/Y/Z, every column pausing on hover. Changes: the
// columns are any content (the caller's cards), the plane angles are Glide's (its review wall
// ran a little flatter than the demo), the four soft edges are a mask instead of painted
// gradients (painted ones showed as a darker box whenever the band colour was not exactly
// `--background`), and sizes are rem.
import type { ReactNode } from 'react'
import { cx } from '../slot-types'
import Marquee from './marquee'

type Marquee3dProps = {
  /** One entry per column, usually four. */
  columns: ReactNode[]
  durationSeconds?: number | undefined
  /** Accessible name for the wall, e.g. "Customer reviews". */
  label: string
  className?: string | undefined
}

/** The demo's direction pattern, repeated for more than four columns. */
const REVERSED = [false, true, true, false]

/** Glide's plane (the demo uses -100px, -100px, 20deg, -10deg, 20deg). */
const PLANE = 'translateX(-2.5rem) translateZ(-5rem) rotateX(18deg) rotateY(-10deg) rotateZ(16deg)'

const EDGE_MASK = [
  'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
  'linear-gradient(to right, transparent, black 14%, black 86%, transparent)',
].join(', ')

export default function Marquee3d({
  columns,
  durationSeconds = 40,
  label,
  className,
}: Marquee3dProps) {
  return (
    <section
      aria-label={label}
      className={cx(
        'relative flex w-full flex-row items-center justify-center overflow-hidden [perspective:56.25rem]',
        className,
      )}
      style={{
        maskImage: EDGE_MASK,
        WebkitMaskImage: EDGE_MASK,
        maskComposite: 'intersect',
        WebkitMaskComposite: 'source-in',
      }}
    >
      <div
        className="flex flex-row items-center gap-[1rem] [transform-style:preserve-3d]"
        style={{ transform: PLANE }}
      >
        {columns.map((column, i) => (
          <Marquee
            // biome-ignore lint/suspicious/noArrayIndexKey: the columns are positional and fixed.
            key={i}
            vertical
            pauseOnHover
            reverse={REVERSED[i % REVERSED.length]}
            durationSeconds={durationSeconds}
            className="h-[55rem]"
          >
            {column}
          </Marquee>
        ))}
      </div>
    </section>
  )
}
