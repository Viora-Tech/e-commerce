'use client'

import { useState } from 'react'
import { homeContent } from '@/data/home'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'
import TourChips from './tour-chips'
import TourRail from './tour-rail'
import TourStage from './tour-stage'

const { tour } = homeContent

/**
 * Auto-rotating feature tour. The active item's progress line runs for the tour interval
 * (6 s, in CSS); when it finishes the tour advances. Hover or focus pauses the line, a click
 * restarts it, and with reduced motion the line is static so the tour never auto-advances.
 */
export default function ProductTour() {
  // Hooks
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  // Event handlers
  const handleSelect = (index: number) => setActive(index)
  const handleFinished = () => setActive((current) => (current + 1) % tour.items.length)

  // Render logic
  const item = tour.items[active] ?? tour.items[0]
  if (!item) return null

  return (
    <section id="tour" className="relative isolate overflow-hidden py-20 md:py-32">
      <AmbientLight className="top-1/2 right-0 h-[30rem] w-[56rem] max-w-full" />
      <PageContainer className="flex flex-col items-center gap-10 md:gap-16">
        <SectionHeading eyebrow={tour.eyebrow} title={tour.title} subtitle={tour.subtitle} />
        <fieldset
          aria-label={tour.tablistLabel}
          className="m-0 flex w-full min-w-0 flex-col gap-6 border-0 p-0 lg:flex-row lg:items-center lg:gap-10"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <TourChips
            items={tour.items}
            active={active}
            paused={paused}
            onSelect={handleSelect}
            onFinished={handleFinished}
          />
          <TourRail
            items={tour.items}
            active={active}
            paused={paused}
            onSelect={handleSelect}
            onFinished={handleFinished}
          />
          <div className="min-w-0 flex-1">
            <TourStage key={item.key} item={item} />
          </div>
        </fieldset>
        <p className="max-w-md text-center text-sm text-muted-foreground lg:hidden">
          {item.description}
        </p>
      </PageContainer>
    </section>
  )
}
