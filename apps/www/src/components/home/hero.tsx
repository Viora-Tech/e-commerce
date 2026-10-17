import Image from 'next/image'
import Link from 'next/link'
import { homeContent } from '@/data/home'
import { waitlistContent } from '@/data/waitlist'
import AmbientLight from '../common/ambient-light'
import HeroEmailCapture from '../waitlist/hero-email-capture'
import HeroFloats from './hero-floats'

const copy = homeContent.hero

export default function Hero() {
  return (
    <section className="relative isolate -mt-[4.5rem] min-h-[50.625rem] overflow-hidden pt-32 md:h-[62.5rem] md:pt-[9.375rem]">
      <AmbientLight className="-top-40 -left-40 h-72 w-96" />
      <AmbientLight className="-top-40 -right-40 h-72 w-96" />
      <AmbientLight className="top-[37.5rem] -right-20 h-[22.5rem] w-[32.5rem]" />
      <AmbientLight className="top-[40rem] -left-20 h-[22.5rem] w-[32.5rem]" />
      <AmbientLight className="top-[35rem] left-1/2 h-[26rem] w-[56rem] -translate-x-1/2" />
      <div className="relative z-10 mx-auto flex max-w-[56.25rem] flex-col items-center gap-5 px-4 text-center md:px-8">
        <p className="glass-panel inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs text-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
          {copy.pill}
        </p>
        <h1 className="text-5xl font-semibold text-balance text-foreground md:text-hero">
          {copy.titleLines[0]}
          <br />
          {copy.titleLines[1]}
        </h1>
        <p className="max-w-[45rem] text-base text-pretty text-muted-foreground md:text-lead">
          {copy.subline}
        </p>
        <div className="flex w-full flex-col items-center gap-3">
          <HeroEmailCapture />
          <p className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{waitlistContent.hero.below}</span>
            <Link href={copy.tourLinkHref} className="link-slide text-foreground">
              {waitlistContent.hero.howItWorks}
            </Link>
          </p>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[30rem]">
        <div className="absolute top-[7.5rem] left-1/2 size-[44rem] -translate-x-1/2 rounded-full border-[1.125rem] border-white opacity-[0.18] blur-[1.25rem] md:top-[2.1rem] md:size-[69.8rem]" />
        <Image
          src="/images/globe.png"
          alt={copy.globeAlt}
          width={1056}
          height={480}
          priority
          className="absolute bottom-0 left-1/2 w-[130%] max-w-none -translate-x-1/2 md:w-[66rem]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
      </div>
      <HeroFloats />
    </section>
  )
}
