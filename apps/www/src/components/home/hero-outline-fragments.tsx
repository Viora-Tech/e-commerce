import { cn } from '@commerce/ui/lib/utils'
import { heroFragmentsContent as copy } from '@/data/demo-store'

const FRAGMENT =
  'absolute hidden rounded-lg border border-white/20 text-[0.6875rem] text-white/55 lg:block animate-drift motion-reduce:animate-none'
const PARALLAX =
  '[translate:calc(var(--px,0)*1.2rem)_calc(var(--py,0)*0.7rem)] transition-[translate] duration-700 ease-(--ease-out) motion-reduce:transition-none'

/**
 * Thin outlined UI fragments (a price tag, a GST invoice, a courier label) that drift very slowly
 * behind the hero text and shift a touch with the cursor. Decorative only: hidden from readers and
 * below the lg breakpoint.
 */
export default function HeroOutlineFragments() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className={cn(FRAGMENT, PARALLAX, 'top-[13rem] left-[6%] -rotate-6 px-3 py-1.5')}>
        <span className="mr-2 inline-block size-1.5 rounded-full border border-white/40" />
        {copy.price}
      </div>
      <div
        className={cn(FRAGMENT, PARALLAX, 'top-[21rem] left-[3%] w-36 p-3 [animation-delay:-4s]')}
      >
        <p className="mb-2 font-mono tracking-wider uppercase">{copy.invoice}</p>
        <span className="mb-1.5 block h-px bg-white/20" />
        <span className="mb-1.5 block h-px w-3/4 bg-white/20" />
        <span className="block h-px w-1/2 bg-white/20" />
      </div>
      <div
        className={cn(
          FRAGMENT,
          PARALLAX,
          'top-[29.5rem] left-[11%] w-40 p-3 [animation-delay:-8s]',
        )}
      >
        <p className="mb-2 font-mono tracking-wider uppercase">{copy.courier}</p>
        <span className="flex h-6 items-stretch gap-px">
          {copy.bars.map((bar) => (
            <span key={bar.id} className={cn('bg-white/30', bar.width)} />
          ))}
        </span>
      </div>
    </div>
  )
}
