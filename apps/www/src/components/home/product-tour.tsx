'use client'

import { useEffect, useRef, useState } from 'react'
import { homeContent } from '@/data/home'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'
import TourCarousel from './tour-carousel'
import TourRail from './tour-rail'
import TourStage from './tour-stage'

const { tour } = homeContent

/**
 * The product tour: an auto-looping tour, 6 s per feature with the rail's progress line filling over
 * time. It starts when the section scrolls into view and pauses when it leaves; hovering or focusing
 * the rail or window pauses it, and a click on a rail item jumps to that feature. Nothing pins or
 * hijacks the scroll. On phones it is a swipeable card carousel that also advances by itself.
 */
export default function ProductTour() {
  // Hooks
  const sectionRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)
  // Once someone uses the stage (clicks, types), the timer stops auto-advancing for good.
  const [engaged, setEngaged] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      {
        threshold: 0.35,
      },
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Event handlers
  const handleSelect = (index: number) => setActive(index)
  const handleFinished = () => setActive((current) => (current + 1) % tour.items.length)

  // Render logic
  const item = tour.items[active] ?? tour.items[0]
  if (!item) return null

  return (
    <section ref={sectionRef} id="tour" className="relative isolate overflow-hidden py-20 md:py-32">
      <AmbientLight className="top-1/2 right-0 h-[30rem] w-[56rem] max-w-full" />
      <PageContainer className="flex flex-col items-center gap-10 md:gap-14">
        <SectionHeading eyebrow={tour.eyebrow} title={tour.title} subtitle={tour.subtitle} />
        <TourCarousel items={tour.items} running={inView} />
        <fieldset
          aria-label={tour.tablistLabel}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="m-0 hidden w-full min-w-0 border-0 p-0 lg:flex lg:flex-row lg:items-center lg:gap-10"
        >
          <TourRail
            items={tour.items}
            active={active}
            paused={paused || engaged || !inView}
            onSelect={handleSelect}
            onFinished={handleFinished}
          />
          <div className="min-w-0 flex-1" onPointerDown={() => setEngaged(true)}>
            <TourStage item={item} />
          </div>
        </fieldset>
      </PageContainer>
    </section>
  )
}
