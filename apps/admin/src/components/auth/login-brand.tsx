import { siteConfig } from '@commerce/config/site'
import { Store } from '@commerce/ui/icons'

export default function LoginBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary-tint text-primary shadow-lift">
        <Store className="size-4" aria-hidden />
      </span>
      <span className="text-card-title text-ink-strong">{siteConfig.brand.name}</span>
    </div>
  )
}
