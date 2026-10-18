import { siteConfig } from '@commerce/config/site'
import KoomerceMark from '@commerce/ui/brand'

export default function LoginBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <KoomerceMark className="h-8 w-auto text-ink-strong" />
      <span className="text-card-title text-ink-strong">{siteConfig.brand.name}</span>
    </div>
  )
}
