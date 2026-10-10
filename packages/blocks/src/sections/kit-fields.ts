import type { IconName } from '../components/icon'
import { kitSectionsContent as copy } from '../data/kit-sections'

/** Field labels shared by the starter kit sections (`./kit.tsx`, `./kit-trust.tsx`). */
export const f = copy.fields

export const sideField = {
  type: 'radio',
  label: f.imageSide,
  options: [
    { label: f.left, value: 'left' },
    { label: f.right, value: 'right' },
  ],
} as const

/** A plain on/off choice (a beam, a highlighted plan, a tick in a comparison row). */
export const yesNo = (label: string) =>
  ({
    type: 'radio',
    label,
    options: [
      { label: f.on, value: true },
      { label: f.off, value: false },
    ],
  }) as const

export const beamField = {
  type: 'radio',
  label: f.beam,
  options: [
    { label: f.on, value: true },
    { label: f.off, value: false },
  ],
} as const

/** The icons a feature card can show: the theme's own set, named in plain words. */
export const ICONS: { label: string; value: IconName }[] = [
  { label: 'Shipping', value: 'shipping' },
  { label: 'Delivery', value: 'delivery' },
  { label: 'Payment', value: 'payment' },
  { label: 'Shield', value: 'shield' },
  { label: 'Quality', value: 'guaranteed' },
  { label: 'Clock', value: 'clock' },
  { label: 'Lightning', value: 'bolt' },
  { label: 'Heart', value: 'heart' },
  { label: 'Star', value: 'star' },
  { label: 'Tick', value: 'check' },
  { label: 'Location', value: 'location' },
  { label: 'Stock', value: 'stock' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Question', value: 'question' },
]

/** A row's own text for the blocks list, or the fallback while it is blank or being typed. */
export const summary = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value ? value : fallback
