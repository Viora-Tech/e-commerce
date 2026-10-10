// Port of sections/featured-product.liquid: Puck config for the single featured product (key `FeaturedProduct`)
import type { ComponentConfig } from '@puckeditor/core'
import FeaturedProduct from '../../components/sections/zero-drift/featured-product'
import { featuredProductContent as copy } from '../../data/zero-drift/featured-product'
import { defaultSectionSettings } from '../../section-settings'
import type { CardProduct } from '../../types'
import { type Frame, framed } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import type { SingleProductLoader } from '../library'

/**
 * Keys saved before the Zero Drift refresh (`kicker`, `handle`, `text`, `button`) keep their names,
 * so those sections render as they did; the rest are the theme's lockup settings.
 */
export type FeaturedProductProps = Frame & {
  kicker: string
  handle: string
  text: string
  button: string
  imageSide: 'left' | 'right'
  showStamp: boolean
  stampText: string
  showShare: boolean
  showHelp: boolean
  helpLink: string
  resolved?: CardProduct | null
}

const f = copy.fields

const yesNo = [
  { label: f.yes, value: true },
  { label: f.no, value: false },
]

const defaults: Omit<FeaturedProductProps, keyof Frame> = {
  kicker: copy.eyebrow,
  handle: '',
  text: '',
  button: '',
  imageSide: 'left',
  showStamp: false,
  stampText: copy.stampText,
  showShare: true,
  showHelp: true,
  helpLink: '',
}

export function featuredProductSection(loaders: {
  loadProduct?: SingleProductLoader | undefined
}): ComponentConfig {
  return framed<FeaturedProductProps>(
    copy.label,
    {
      handle: { type: 'text', label: f.handle },
      kicker: inlineText(f.eyebrow),
      text: inlineRichtext(f.text),
      button: inlineText(f.button),
      imageSide: {
        type: 'radio',
        label: f.imageSide,
        options: [
          { label: f.left, value: 'left' },
          { label: f.right, value: 'right' },
        ],
      },
      showStamp: { type: 'radio', label: f.showStamp, options: yesNo },
      stampText: { type: 'text', label: f.stampText },
      showShare: { type: 'radio', label: f.showShare, options: yesNo },
      showHelp: { type: 'radio', label: f.showHelp, options: yesNo },
      helpLink: { type: 'text', label: f.helpLink },
    },
    defaults,
    (p) => (
      <FeaturedProduct
        product={p.resolved ?? null}
        eyebrow={p.kicker}
        text={p.text}
        buttonLabel={p.button}
        imageSide={p.imageSide}
        showStamp={p.showStamp}
        stampText={p.stampText}
        showShare={p.showShare}
        showHelp={p.showHelp}
        helpHref={p.helpLink}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 64, padBottom: 64 }),
        ...defaults,
      },
      resolveData: async ({ props }) => ({
        props: {
          resolved:
            props.handle && loaders.loadProduct ? await loaders.loadProduct(props.handle) : null,
        },
        readOnly: { resolved: true },
      }),
    },
  )
}
