import { affiliateContent } from '@/data/affiliate'

type AffiliateBrandPanelProps = {
  storeName: string
  /** "10%" or "₹150": what an affiliate earns per order, for the panel's line. */
  rate: string
}

const copy = affiliateContent.register

/**
 * The signup page's brand half (the shadcn login block's image side): the store's name large on
 * the brand colour with "Become our partner" and the rate, kept mid-screen. On a phone it is a
 * short band above the form. Headings use important utilities because an imported theme's
 * `p`/heading styles would otherwise win.
 */
export default function AffiliateBrandPanel({ storeName, rate }: AffiliateBrandPanelProps) {
  // Render logic
  return (
    <aside className="relative flex flex-col items-center justify-center overflow-clip bg-brand px-6 py-10 text-center text-on-brand sm:px-10 lg:min-h-full lg:justify-start lg:px-16 lg:py-20">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[6rem] -right-[6rem] size-[18rem] rounded-full bg-on-brand opacity-10"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[8rem] -left-[5rem] size-[20rem] rounded-full bg-on-brand opacity-10"
      />
      {/* On a long form the words stay in the middle of the screen while it scrolls, below the
          store's own sticky header, instead of sinking to the middle of the whole page. */}
      <div className="relative flex flex-col items-center gap-3 lg:sticky lg:top-[calc(50svh-5rem)]">
        <p className="relative m-0! text-[0.75rem]! font-semibold! tracking-[0.2em] uppercase opacity-80">
          {copy.partner}
        </p>
        <p className="relative m-0! text-[2rem]! leading-tight! font-bold! text-balance text-on-brand! normal-case! lg:text-[3rem]!">
          {storeName}
        </p>
        <p className="relative m-0! max-w-[22rem] text-[1rem]! text-on-brand! opacity-90 lg:text-[1.125rem]!">
          {copy.panelRate(rate)}
        </p>
      </div>
    </aside>
  )
}
