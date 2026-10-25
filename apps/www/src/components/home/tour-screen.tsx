import Image from 'next/image'
import type { TourItem } from '@/data/home'
import WindowFrame from '../common/window-frame'
import MockAdmin from './mock-admin'
import ShopifyMock from './shopify-mock'

type TourScreenProps = { item: TourItem }

/** The window for one tour item: the interactive admin mock, a screenshot, or the Shopify mock. */
export default function TourScreen({ item }: TourScreenProps) {
  const { screen } = item
  if (item.key === 'ai') return <MockAdmin />
  if (screen.kind === 'shopify') return <ShopifyMock variant="after" className="mx-auto w-[92%]" />
  if (!screen.framed) {
    return (
      <Image
        src={screen.src}
        alt={screen.alt}
        width={screen.width}
        height={screen.height}
        className="h-auto w-full"
      />
    )
  }
  return (
    <WindowFrame
      src={screen.src}
      alt={screen.alt}
      width={screen.width}
      height={screen.height}
      className="mx-auto w-[92%]"
    />
  )
}
