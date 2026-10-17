'use client'

import {
  ArrowDown_ as ArrowDown,
  ArrowRight_ as ArrowRight,
  Upload_ as Upload,
} from '@commerce/ui/icons'
import { useEffect, useRef } from 'react'
import { homeContent } from '@/data/home'
import { loadGsap, prefersReducedMotion } from '@/lib/gsap'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'
import ShopifyMock from './shopify-mock'

const copy = homeContent.shopify

/**
 * Scroll-scrubbed theme import (desktop, motion allowed): the section pins, a theme.zip drops in,
 * unpacks into its folders, and the storefront on the right assembles block by block as you
 * scroll. On phones and with reduced motion it is the plain before/after pair.
 */
export default function ShopifyImport() {
  // Hooks
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || prefersReducedMotion()) return
    let cancelled = false
    let revert = () => {}
    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return
      const query = gsap.matchMedia()
      query.add('(min-width: 1024px) and (min-height: 760px)', () => {
        const zip = section.querySelector('[data-zip]')
        const files = section.querySelectorAll('[data-file]')
        const blocks = section.querySelectorAll('[data-after] [data-assemble]')
        gsap.set(blocks, { opacity: 0, y: 28, scale: 0.97, filter: 'blur(6px)' })
        const timeline = gsap.timeline({
          defaults: { ease: 'power2.out' },
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=130%',
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
          },
        })
        timeline
          .fromTo(
            zip,
            { y: -180, opacity: 0, scale: 0.9 },
            { y: 0, opacity: 1, scale: 1, duration: 0.2 },
            0,
          )
          .to(zip, { scale: 1.1, duration: 0.06 }, 0.22)
          .to(zip, { opacity: 0, scale: 0.6, duration: 0.1 }, 0.28)
          .fromTo(
            files,
            { opacity: 0, scale: 0.5, y: 0 },
            {
              opacity: 1,
              scale: 1,
              y: (index: number) => [-26, 0, 26][index] ?? 0,
              stagger: 0.04,
              duration: 0.14,
            },
            0.28,
          )
          .to(files, { opacity: 0, x: 40, stagger: 0.04, duration: 0.14 }, 0.46)
          .to(
            blocks,
            { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', stagger: 0.07, duration: 0.14 },
            0.4,
          )
        timeline.to({}, { duration: 0.12 })
        return () => {
          timeline.scrollTrigger?.kill()
          timeline.kill()
          gsap.set([zip, files, blocks], { clearProps: 'all' })
        }
      })
      revert = () => {
        query.revert()
        ScrollTrigger.refresh()
      }
    })
    return () => {
      cancelled = true
      revert()
    }
  }, [])

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden py-20 md:py-28">
      <AmbientLight className="top-1/2 left-1/2 h-72 w-[56rem] max-w-full -translate-x-1/2" />
      <PageContainer className="flex flex-col items-center gap-10 md:gap-14">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
        <div className="grid w-full max-w-[68rem] items-center gap-6 md:grid-cols-[1fr_auto_1fr] md:gap-8">
          <ShopifyMock variant="before" />
          <div className="relative flex min-w-28 flex-col items-center gap-3">
            <span
              data-zip
              className="glass-panel inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs text-foreground"
            >
              <Upload aria-hidden className="size-3.5" />
              {copy.zip}
            </span>
            <ArrowRight aria-hidden className="hidden size-5 text-muted-foreground md:block" />
            <ArrowDown aria-hidden className="size-5 text-muted-foreground md:hidden" />
            <ul
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              {copy.files.map((file) => (
                <li
                  key={file}
                  data-file
                  className="glass-panel absolute -translate-x-1/2 -translate-y-1/2 rounded-md px-2 py-1 font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground opacity-0"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>
          <div data-after>
            <ShopifyMock variant="after" />
          </div>
        </div>
      </PageContainer>
    </section>
  )
}
