'use client'

import { ArrowRight_ as ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { homeContent, type TourItem } from '@/data/home'
import WindowFrame from '../common/window-frame'
import ShopifyMock from './shopify-mock'

type TourCarouselProps = { items: readonly TourItem[]; running: boolean }

const ADVANCE_MS = 6000

function CardScreen({ item }: { item: TourItem }) {
  const { screen } = item
  if (screen.kind === 'shopify') return <ShopifyMock variant="after" />
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
    <WindowFrame src={screen.src} alt={screen.alt} width={screen.width} height={screen.height} />
  )
}

/** Phone layout: no pin, just a swipeable row of feature cards (scroll-snap) with dots. */
export default function TourCarousel({ items, running }: TourCarouselProps) {
  // Hooks
  const scrollerRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!running || touched || !scroller) return
    const timer = setInterval(() => {
      const first = scroller.firstElementChild as HTMLElement | null
      if (!first) return
      const step = first.offsetWidth + 16
      const index = Math.round(scroller.scrollLeft / step)
      const next = (index + 1) % items.length
      scroller.scrollTo({ left: next * step, behavior: 'smooth' })
    }, ADVANCE_MS)
    return () => clearInterval(timer)
  }, [running, touched, items.length])

  const goTo = (index: number) => {
    const scroller = scrollerRef.current
    const first = scroller?.firstElementChild as HTMLElement | null
    if (!scroller || !first) return
    setTouched(true)
    scroller.scrollTo({ left: index * (first.offsetWidth + 16), behavior: 'smooth' })
  }

  // Event handlers
  const handleScroll = () => {
    const scroller = scrollerRef.current
    const first = scroller?.firstElementChild as HTMLElement | null
    if (!scroller || !first) return
    const step = first.offsetWidth + 16
    setActive(Math.min(items.length - 1, Math.max(0, Math.round(scroller.scrollLeft / step))))
  }

  return (
    <div className="flex flex-col gap-5 lg:hidden">
      <ul
        ref={scrollerRef}
        onScroll={handleScroll}
        onPointerDown={() => setTouched(true)}
        aria-label={homeContent.tour.tablistLabel}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2"
      >
        {items.map((item) => (
          <li
            key={item.key}
            className="glass-panel flex w-[86%] shrink-0 snap-center flex-col gap-4 rounded-3xl p-4"
          >
            <div className="overflow-hidden rounded-2xl">
              <CardScreen item={item} />
            </div>
            <div className="flex flex-col gap-1.5 px-1 pb-1">
              <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <a
                href={item.learnMoreHref}
                className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-foreground underline underline-offset-4"
              >
                {homeContent.tour.learnMore}
                <ArrowRight aria-hidden className="size-3.5" />
              </a>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-center gap-1.5">
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            aria-label={item.title}
            aria-current={index === active}
            onClick={() => goTo(index)}
            className={cn(
              'size-1.5 rounded-full outline-none transition-colors duration-300 ease-(--ease-out) focus-visible:ring-3 focus-visible:ring-ring/50',
              index === active ? 'bg-foreground' : 'bg-border-strong',
            )}
          />
        ))}
      </div>
    </div>
  )
}
