import type { ComponentConfig } from '@puckeditor/core'
import EditorOverlay from '../../components/editor-overlay'
import SignupPopup from '../../components/sections/zero-drift/signup-popup'
import type {
  PopupTrigger,
  PopupWhere,
} from '../../components/sections/zero-drift/signup-popup-timing'
import { signupPopupContent as copy } from '../../data/zero-drift/signup-popup'
import type { CardProduct } from '../../types'
import type { SectionMetadata } from '../dynamic'
import { type Image, imageField, noImage } from '../framed'
import { inlineText, inlineTextarea } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

export type PopupStyle = 'corner' | 'figure' | 'feed'

export type SignupPopupProps = {
  style: PopupStyle
  image: Image
  figureProduct: string
  feedProducts: { handle: string }[]
  where: PopupWhere
  collections: string
  trigger: PopupTrigger
  delay: number
  delayMobile: number
  scroll: number
  repeatDays: number
  kicker: string
  heading: string
  text: string
  buttonLabel: string
  finePrint: string
  successHeading: string
  successText: string
  discountCode: string
  /** Filled by resolveData; not edited directly. */
  resolved?: { figure: CardProduct | null; feed: CardProduct[] } | undefined
}

const MAX_FEED = 3

const defaults: SignupPopupProps = {
  style: 'corner',
  image: noImage,
  figureProduct: '',
  feedProducts: [],
  where: 'all',
  collections: '',
  trigger: 'engaged',
  delay: 20,
  delayMobile: 30,
  scroll: 50,
  repeatDays: 14,
  kicker: copy.kicker,
  heading: copy.heading,
  text: copy.text,
  buttonLabel: copy.buttonLabel,
  finePrint: copy.finePrint,
  successHeading: copy.successHeading,
  successText: copy.successText,
  discountCode: copy.discountCode,
}

const seconds = (label: string, min: number, max: number) =>
  ({ type: 'number', label, min, max }) as const

// Port of sections/signup-popup.liquid: three looks (corner, figure, feed), opened by
// delay, scroll depth or exit intent, posting to the storefront's newsletter action.
// Not framed: a popup has no band, padding or colour scheme of its own.
export function signupPopupSection(loaders: ZeroDriftLoaders): ComponentConfig {
  return {
    label: copy.label,
    fields: {
      style: { type: 'select', label: copy.fields.style, options: copy.styleOptions },
      image: imageField(copy.fields.image),
      figureProduct: { type: 'text', label: copy.fields.figureProduct },
      feedProducts: {
        type: 'array',
        label: copy.fields.feedProducts,
        max: MAX_FEED,
        getItemSummary: (p: { handle?: string }) => p.handle || copy.feedFallback,
        arrayFields: { handle: { type: 'text', label: copy.fields.feedHandle } },
      },
      where: { type: 'select', label: copy.fields.where, options: copy.whereOptions },
      collections: { type: 'text', label: copy.fields.collections },
      trigger: { type: 'select', label: copy.fields.trigger, options: copy.triggerOptions },
      delay: seconds(copy.fields.delay, 3, 60),
      delayMobile: seconds(copy.fields.delayMobile, 3, 90),
      scroll: seconds(copy.fields.scroll, 10, 100),
      repeatDays: seconds(copy.fields.repeatDays, 1, 60),
      kicker: inlineText(copy.fields.kicker),
      heading: inlineText(copy.fields.heading),
      text: inlineTextarea(copy.fields.text),
      buttonLabel: inlineText(copy.fields.buttonLabel),
      finePrint: inlineText(copy.fields.finePrint),
      successHeading: inlineText(copy.fields.successHeading),
      successText: inlineText(copy.fields.successText),
      discountCode: { type: 'text', label: copy.fields.discountCode },
    },
    defaultProps: defaults,
    resolveData: async ({ props }: { props: SignupPopupProps }) => {
      const load = loaders.loadProduct
      const figure =
        props.style === 'figure' && props.figureProduct && load
          ? await load(props.figureProduct)
          : null
      const handles =
        props.style === 'feed'
          ? (props.feedProducts ?? [])
              .map((p) => p.handle)
              .filter(Boolean)
              .slice(0, MAX_FEED)
          : []
      const feed = load
        ? (await Promise.all(handles.map((h) => load(h)))).filter(
            (p): p is CardProduct => p !== null,
          )
        : []
      return { props: { resolved: { figure, feed } }, readOnly: { resolved: true } }
    },
    render: ({
      puck,
      id,
      ...props
    }: SignupPopupProps & { id?: string; puck?: { metadata?: unknown; isEditing?: boolean } }) => {
      const p = { ...defaults, ...props }
      const meta = (puck?.metadata ?? {}) as SectionMetadata
      const editing = Boolean(puck?.isEditing)
      const popup = (
        <SignupPopup
          {...p}
          sectionId={typeof id === 'string' ? id : p.style}
          figure={p.resolved?.figure ?? null}
          feed={p.resolved?.feed ?? []}
          editing={editing}
          floating={editing}
          action={meta.newsletterAction}
        />
      )
      if (!editing) return popup
      return (
        <EditorOverlay
          id={typeof id === 'string' ? id : undefined}
          label={copy.label}
          when={copy.triggerNotes[p.trigger]}
        >
          {popup}
        </EditorOverlay>
      )
    },
  } as unknown as ComponentConfig
}
