import { CircleCheck } from '@commerce/ui/icons'
import Image from 'next/image'
import type { TourItem } from '@/data/home'
import WindowFrame from '../common/window-frame'
import MockAdmin from './mock-admin'
import ShopifyMock from './shopify-mock'

type TourStageProps = { item: TourItem }

const CHIP_CLASS =
  'glass-panel absolute flex items-center gap-3 rounded-full py-1.5 pr-5 pl-1.5 text-sm font-medium text-foreground animate-float'

export default function TourStage({ item }: TourStageProps) {
  const { screen } = item

  return (
    <div
      id="tour-panel"
      role="tabpanel"
      aria-labelledby={`tour-tab-${item.key}`}
      className="relative mx-auto w-full max-w-190"
    >
      <div className="animate-tour-in relative">
        {item.key === 'ai' ? (
          <MockAdmin />
        ) : screen.kind === 'image' && !screen.framed ? (
          <Image
            src={screen.src}
            alt={screen.alt}
            width={screen.width}
            height={screen.height}
            className="h-auto w-full"
          />
        ) : screen.kind === 'image' ? (
          <WindowFrame
            url={item.url}
            src={screen.src}
            alt={screen.alt}
            width={screen.width}
            height={screen.height}
            className="mx-auto w-[92%]"
          />
        ) : (
          <ShopifyMock variant="after" className="mx-auto w-[92%]" />
        )}
      </div>
      <span className={`${CHIP_CLASS} top-1/4 -left-2 max-sm:left-0 sm:-left-6`}>
        <span className="grid size-8 place-items-center rounded-full bg-muted">
          <CircleCheck aria-hidden className="size-4" />
        </span>
        {item.chips[0]}
      </span>
      <span className={`${CHIP_CLASS} right-0 bottom-[12%] max-sm:hidden`}>
        <span className="grid size-8 place-items-center rounded-full bg-muted">
          <CircleCheck aria-hidden className="size-4" />
        </span>
        {item.chips[1]}
      </span>
    </div>
  )
}
