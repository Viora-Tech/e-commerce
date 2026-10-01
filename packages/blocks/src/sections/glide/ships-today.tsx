import ShipsToday from '../../components/sections/glide/ships-today'
import { shipsTodayContent as copy } from '../../data/glide/ships-today'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed } from '../framed'
import { inlineText } from '../inline-fields'
import type { GlideLoaders } from './loaders'

export type ShipsTodayProps = Frame & {
  cutoffHour: number
  timezoneOffset: number
  beforeText: string
  afterText: string
  countText: string
  collectionHandle: string
  items: { icon: string; text: string }[]
  /** Filled by resolveData; not edited directly. */
  resolved?: { inStock: number }
}

const defaults = {
  cutoffHour: copy.cutoffHour,
  timezoneOffset: copy.timezoneOffset,
  beforeText: copy.before,
  afterText: copy.after,
  countText: copy.count,
  collectionHandle: copy.collectionHandle,
  items: copy.items.map((i) => ({ ...i })),
}

export function shipsTodaySection(loaders: GlideLoaders) {
  return framed<ShipsTodayProps>(
    copy.label,
    {
      cutoffHour: {
        type: 'number',
        label: 'Dispatch cut-off hour (store time)',
        min: 8,
        max: 20,
      },
      timezoneOffset: {
        type: 'number',
        label: 'Store time zone, minutes from UTC (India is 330)',
        min: -720,
        max: 840,
        step: 30,
      },
      beforeText: {
        type: 'text',
        label: 'Line before the cut-off (use {time} for the time left)',
      },
      afterText: {
        type: 'text',
        label: 'Line after the cut-off (use {cutoff} for the cut-off hour)',
      },
      countText: { type: 'text', label: 'Stock line (use {count} for the number)' },
      collectionHandle: { type: 'text', label: 'Collection to count in-stock products from' },
      items: {
        type: 'array',
        label: 'Promise lines',
        max: 3,
        getItemSummary: (i: { text?: string }) => (typeof i.text === 'string' && i.text) || 'Line',
        defaultItemProps: { ...copy.newItem },
        arrayFields: {
          icon: { type: 'select', label: 'Icon', options: copy.icons },
          text: inlineText('Text'),
        },
      },
    },
    defaults,
    (p) => (
      <div className="section-ships-today">
        <ShipsToday
          cutoffHour={p.cutoffHour}
          timezoneOffset={p.timezoneOffset}
          beforeText={p.beforeText}
          afterText={p.afterText}
          countText={p.countText}
          collectionHandle={p.collectionHandle}
          inStock={p.resolved?.inStock ?? 0}
          items={p.items}
        />
      </div>
    ),
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 0 }),
      },
      resolveData: async ({ props }) => {
        const products = props.collectionHandle
          ? await loaders.loadProducts({
              collectionHandle: props.collectionHandle,
              limit: copy.stockSampleSize,
            })
          : []
        return {
          props: { resolved: { inStock: products.filter((x) => x.available > 0).length } },
          readOnly: { resolved: true },
        }
      },
    },
  )
}
