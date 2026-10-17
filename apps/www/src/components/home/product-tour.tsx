'use client'

import { useRef, useState } from 'react'
import { homeContent } from '@/data/home'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'
import TourCarousel from './tour-carousel'
import TourRail from './tour-rail'
import TourStage from './tour-stage'
import useTourScroll from './use-tour-scroll'

const { tour } = homeContent

/**
 * The product tour. On desktop the section pins while you scroll and each feature takes over in
 * turn (GSAP ScrollTrigger, see `use-tour-scroll.ts`); the rail's progress line fills with the
 * scroll and a click scrolls to that feature. Without the pin (reduced motion, short screens) it
 * is the Figma timer tour: 6 s per feature, paused on hover or focus. On phones it is a swipeable
 * card carousel instead.
 */
export default function ProductTour() {
  // Hooks
  const sectionRef = useRef<HTMLElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  // Once someone uses the stage (clicks, types), the timer stops auto-advancing for good.
  const [engaged, setEngaged] = useState(false)
  const { pinned, scrollToIndex } = useTourScroll({
    sectionRef,
    progressRef,
    count: tour.items.length,
    onIndex: setActive,
  })

  // Event handlers
  const handleSelect = (index: number) => (pinned ? scrollToIndex(index) : setActive(index))
  const handleFinished = () => setActive((current) => (current + 1) % tour.items.length)

  // Render logic
  const item = tour.items[active] ?? tour.items[0]
  if (!item) return null

  return (
    <section
      ref={sectionRef}
      id="tour"
      className="relative isolate flex flex-col justify-center overflow-hidden py-20 md:py-24 lg:min-h-svh lg:py-10"
    >
      <AmbientLight className="top-1/2 right-0 h-[30rem] w-[56rem] max-w-full" />
      <PageContainer className="flex flex-col items-center gap-8 md:gap-10">
        <SectionHeading
          eyebrow={tour.eyebrow}
          title={tour.title}
          subtitle={tour.subtitle}
          size="subsection"
        />
        <TourCarousel items={tour.items} />
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
            paused={paused || engaged}
            pinned={pinned}
            progressRef={progressRef}
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
