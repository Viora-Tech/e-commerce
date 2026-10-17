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
    <section className="relative isolate -mt-[4.5rem] overflow-hidden pt-36 md:pt-44">
      <AmbientLight className="-top-40 -left-40 h-72 w-96" />
      <AmbientLight className="-top-40 -right-40 h-72 w-96" />
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 text-center md:px-8">
        <p className="glass-popover inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs text-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
          {copy.pill}
        </p>
        <h1 className="text-5xl font-semibold text-balance text-foreground md:text-hero">
          {copy.titleLines[0]}
          <br />
          {copy.titleLines[1]}
        </h1>
        <p className="max-w-3xl text-base text-pretty text-muted-foreground md:text-lead">
          {copy.subline}
        </p>
        <div className="flex w-full flex-col items-center gap-3 pt-2">
          <HeroEmailCapture />
          <p className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{waitlistContent.hero.below}</span>
            <Link href={copy.tourLinkHref} className="text-foreground underline underline-offset-2">
              {waitlistContent.hero.howItWorks}
            </Link>
          </p>
        </div>
      </div>
      <div className="relative mt-12 h-72 md:mt-0 md:h-[28rem]">
        <Image
          src="/images/globe.png"
          alt={copy.globeAlt}
          width={1056}
          height={480}
          priority
          className="absolute bottom-0 left-1/2 w-[130%] max-w-none -translate-x-1/2 md:w-[66rem]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent"
        />
      </div>
      <HeroFloats />
    </section>
  )
}
