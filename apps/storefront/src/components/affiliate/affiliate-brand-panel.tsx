import { affiliateContent } from '@/data/affiliate'

type AffiliateBrandPanelProps = { storeName: string }

const copy = affiliateContent.register

/**
 * The signup page's left column: the store's name large on a solid brand-colour panel with
 * "Become our partner" under it, centred top to bottom. On a phone it is a short band on top.
 */
export default function AffiliateBrandPanel({ storeName }: AffiliateBrandPanelProps) {
  // Render logic
  return (
    <div className="flex flex-col items-center justify-center gap-2 bg-brand px-4 py-8 text-center text-on-brand sm:px-8 lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:px-12 lg:py-16">
      <p className="m-0 text-[1.75rem] font-bold leading-tight text-balance lg:text-[2.5rem]">
        {storeName}
      </p>
      <p className="m-0 text-body opacity-90 lg:text-[1.125rem]">{copy.partner}</p>
    </div>
  )
}
