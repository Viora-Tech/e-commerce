/**
 * SOURCE OF TRUTH KEYWORDS: latest drop copy, spotlight, countdown labels
 * WHAT:  Every default and fixed UI string of the Latest drop section.
 * WHY:   Components never carry copy literals; defaults come from Zero Drift's templates/index.json
 *        and locales (sections.latest_drop, general.countdown).
 * WHERE: `components/sections/zero-drift/latest-drop*.tsx`, `sections/zero-drift/latest-drop.tsx`.
 */
export const latestDropContent = {
  label: 'Latest drop',
  kicker: 'Latest drop',
  ctaLabel: 'Shop now',
  empty: 'Pick a product handle to show your latest drop here.',
  countdown: {
    label: 'Time left',
    days: 'Days',
    hours: 'Hrs',
    minutes: 'Min',
    seconds: 'Sec',
  },
  specs: [] as { label: string; value: string }[],
  fields: {
    productHandle: 'Product handle',
    kicker: 'Small heading above the name',
    blurb: 'Short description',
    deadline: 'Countdown ends (date and time, e.g. 2026-09-01T00:00:00+05:30)',
    ctaLabel: 'Button label',
    secondaryLink: 'Second link address',
    secondaryLabel: 'Second link label',
    specs: 'Spec chips',
    spec: 'Spec',
    specLabel: 'Label',
    specValue: 'Value',
  },
} as const
