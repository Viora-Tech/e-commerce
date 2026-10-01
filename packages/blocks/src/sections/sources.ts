/** Where a "modern" section's pattern came from, for the Add panel's "by <name>" credit. */
export type SectionSource = { name: string; href: string }

export const SECTION_SOURCES: Record<string, SectionSource> = {
  SpotlightHero: { name: 'Aceternity UI', href: 'https://ui.aceternity.com' },
  SplitHero: { name: 'shadcnblocks', href: 'https://www.shadcnblocks.com' },
  VideoHero: { name: 'shadcnblocks', href: 'https://www.shadcnblocks.com' },
  BentoGrid: { name: 'Magic UI', href: 'https://magicui.design' },
  LogoMarquee: { name: 'Magic UI', href: 'https://magicui.design' },
  TestimonialMarquee: { name: 'Magic UI', href: 'https://magicui.design' },
  StatsCounter: { name: 'Magic UI', href: 'https://magicui.design' },
  FaqAccordion: { name: 'shadcnblocks', href: 'https://www.shadcnblocks.com' },
  CtaBanner: { name: 'Magic UI', href: 'https://magicui.design' },
  Gallery: { name: 'shadcnblocks', href: 'https://www.shadcnblocks.com' },
  // Glide theme sections built on a shared UI-kit effect (`../effects/`).
  ReviewsShowcase: { name: 'Magic UI and Aceternity UI', href: 'https://magicui.design' },
  LatestDrop: { name: 'Aceternity UI', href: 'https://ui.aceternity.com' },
  BrandLab: { name: 'Aceternity UI', href: 'https://ui.aceternity.com' },
}
