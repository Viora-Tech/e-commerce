// Port of sections/image-comparison.liquid: Puck config for the before/after slider
import type { ComponentConfig } from '@puckeditor/core'
import ImageComparison from '../../components/sections/glide/image-comparison'
import { imageComparisonContent as copy } from '../../data/glide/image-comparison'
import { defaultSectionSettings } from '../../section-settings'
import type { CardProduct } from '../../types'
import { type Frame, framed, type Image, imageField, noImage } from '../framed'
import { inlineText } from '../inline-fields'
import type { GlideLoaders } from './loaders'

export type ImageComparisonProps = Frame & {
  heading: string
  imageBefore: Image
  imageAfter: Image
  productBefore: string
  productBeforeImage: number
  productAfter: string
  productAfterImage: number
  labelBefore: string
  labelAfter: string
  fit: 'wide' | 'image'
  rotate: '0' | 'left' | 'right'
  zoom: number
  startPosition: number
  /** Filled by resolveData: the chosen picture of each product, when one is named. */
  resolved?: { before: Image | null; after: Image | null }
}

const f = copy.fields

const defaults: Omit<ImageComparisonProps, keyof Frame> = {
  heading: copy.heading,
  imageBefore: noImage,
  imageAfter: noImage,
  productBefore: '',
  productBeforeImage: 1,
  productAfter: '',
  productAfterImage: 1,
  labelBefore: copy.labelBefore,
  labelAfter: copy.labelAfter,
  fit: 'wide',
  rotate: '0',
  zoom: 100,
  startPosition: 50,
}

/** The product's n-th picture (1-based), its first when there are fewer. */
function productPicture(product: CardProduct | null, n: number): Image | null {
  const images = product?.images.filter((i) => i.url) ?? []
  const image = images[Math.max(0, Math.round(n) - 1)] ?? images[0]
  return image && product ? { ...image, alt: image.alt ?? product.title } : null
}

export function imageComparisonSection(loaders: GlideLoaders): ComponentConfig {
  const load = (handle: string) =>
    handle && loaders.loadProduct ? loaders.loadProduct(handle) : Promise.resolve(null)
  return framed<ImageComparisonProps>(
    copy.label,
    {
      heading: inlineText(f.heading),
      imageBefore: imageField(f.imageBefore),
      imageAfter: imageField(f.imageAfter),
      productBefore: { type: 'text', label: f.productBefore },
      productBeforeImage: { type: 'number', label: f.productImage, min: 1, max: 12 },
      productAfter: { type: 'text', label: f.productAfter },
      productAfterImage: { type: 'number', label: f.productImage, min: 1, max: 12 },
      labelBefore: inlineText(f.labelBefore),
      labelAfter: inlineText(f.labelAfter),
      fit: {
        type: 'radio',
        label: f.fit,
        options: [
          { label: f.fitWide, value: 'wide' },
          { label: f.fitImage, value: 'image' },
        ],
      },
      rotate: {
        type: 'select',
        label: f.rotate,
        options: [
          { label: f.rotateNone, value: '0' },
          { label: f.rotateLeft, value: 'left' },
          { label: f.rotateRight, value: 'right' },
        ],
      },
      zoom: { type: 'number', label: f.zoom, min: 100, max: 250, step: 10 },
      startPosition: { type: 'number', label: f.startPosition, min: 10, max: 90, step: 5 },
    },
    defaults,
    (p) => (
      <ImageComparison
        heading={p.heading}
        before={p.imageBefore?.url ? p.imageBefore : (p.resolved?.before ?? null)}
        after={p.imageAfter?.url ? p.imageAfter : (p.resolved?.after ?? null)}
        labelBefore={p.labelBefore}
        labelAfter={p.labelAfter}
        fit={p.fit}
        rotate={p.rotate}
        zoom={p.zoom}
        start={p.startPosition}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 64, padBottom: 64 }),
        ...defaults,
      },
      resolveData: async ({ props }) => {
        const [before, after] = await Promise.all([
          load(props.productBefore),
          load(props.productAfter),
        ])
        return {
          props: {
            resolved: {
              before: productPicture(before, props.productBeforeImage),
              after: productPicture(after, props.productAfterImage),
            },
          },
          readOnly: { resolved: true },
        }
      },
    },
  )
}
