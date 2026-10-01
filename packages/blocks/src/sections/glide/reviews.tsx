// Port of sections/reviews.liquid: Puck config for merchant-typed customer reviews (the @app block part is not ported)
import type { ComponentConfig } from '@puckeditor/core'
import Reviews from '../../components/sections/glide/reviews'
import { reviewsContent as copy } from '../../data/glide/reviews'
import { defaultSectionSettings } from '../../section-settings'
import type { CardProduct } from '../../types'
import { type Frame, framed, type Image, imageField, noImage } from '../framed'
import { inlineText, inlineTextarea } from '../inline-fields'
import type { GlideLoaders } from './loaders'

export type ReviewBlock = {
  name: string
  body: string
  rating: number
  product: string
  date: string
  verified: boolean
  photo: Image
}

export type ReviewsProps = Frame & {
  kicker: string
  heading: string
  bodyLines: number
  aggregateRating: string
  aggregateText: string
  writeLabel: string
  writeUrl: string
  reviews: ReviewBlock[]
  /** Filled by resolveData, one entry per review (null when it names no product). */
  resolved?: (CardProduct | null)[]
}

const f = copy.fields

const emptyReview: ReviewBlock = {
  name: '',
  body: '',
  rating: 5,
  product: '',
  date: '',
  verified: false,
  photo: noImage,
}

const defaults: Omit<ReviewsProps, keyof Frame> = {
  kicker: copy.kicker,
  heading: copy.heading,
  bodyLines: copy.bodyLines,
  aggregateRating: '',
  aggregateText: '',
  writeLabel: copy.writeLabel,
  writeUrl: copy.writeUrl,
  reviews: [emptyReview, emptyReview, emptyReview].map((r) => ({ ...r })),
}

const fields = {
  kicker: inlineText(f.kicker),
  heading: inlineText(f.heading),
  reviews: {
    type: 'array',
    label: f.reviews,
    max: 12,
    getItemSummary: (r: { name?: unknown }) =>
      typeof r.name === 'string' && r.name ? r.name : f.review,
    defaultItemProps: emptyReview,
    arrayFields: {
      name: inlineText(f.name),
      body: inlineTextarea(f.body),
      rating: {
        type: 'select',
        label: f.rating,
        options: [
          { label: f.noRating, value: 0 },
          ...[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: n })),
        ],
      },
      product: { type: 'text', label: f.product },
      date: { type: 'text', label: f.date },
      verified: {
        type: 'radio',
        label: f.verified,
        options: [
          { label: f.yes, value: true },
          { label: f.no, value: false },
        ],
      },
      photo: imageField(f.photo),
    },
  },
  bodyLines: { type: 'number', label: f.bodyLines, min: 3, max: 12 },
  aggregateRating: { type: 'text', label: f.aggregateRating },
  aggregateText: inlineText(f.aggregateText),
  writeLabel: inlineText(f.writeLabel),
  writeUrl: { type: 'text', label: f.writeUrl },
}

export function reviewsSection(loaders: GlideLoaders): ComponentConfig {
  const base = framed<ReviewsProps & { editing?: boolean }>(
    copy.label,
    fields,
    defaults,
    (p) => (
      <Reviews
        kicker={p.kicker}
        heading={p.heading}
        bodyLines={p.bodyLines}
        aggregateRating={p.aggregateRating}
        aggregateText={p.aggregateText}
        writeLabel={p.writeLabel}
        writeUrl={p.writeUrl}
        editing={p.editing === true}
        reviews={(p.reviews ?? []).map((r, i) => ({
          name: r.name,
          body: r.body,
          rating: Number(r.rating) || 0,
          date: r.date,
          verified: r.verified === true,
          photo: r.photo,
          product: p.resolved?.[i] ?? null,
        }))}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 64, padBottom: 64 }),
        ...defaults,
      },
      resolveData: async ({ props }) => ({
        props: {
          resolved: await Promise.all(
            (props.reviews ?? []).map((r) =>
              r.product && loaders.loadProduct
                ? loaders.loadProduct(r.product)
                : Promise.resolve(null),
            ),
          ),
        },
        readOnly: { resolved: true },
      }),
    },
  )
  // The theme shows an empty section only in its editor; Puck says which one this is.
  const render = base.render
  return {
    ...base,
    render: (props) => render({ ...props, editing: props.puck?.isEditing === true }),
  } as ComponentConfig
}
