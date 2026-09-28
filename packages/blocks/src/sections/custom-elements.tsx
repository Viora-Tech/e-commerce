import type { ComponentConfig } from '@puckeditor/core'
import BadgeElement, { type BadgeProps } from '../components/custom/badge-element'
import ButtonElement, { type ButtonElementProps } from '../components/custom/button-element'
import DividerElement, { type DividerProps } from '../components/custom/divider-element'
import EmbedElement, { type CustomHtmlProps } from '../components/custom/embed-element'
import HeadingElement, { type HeadingProps } from '../components/custom/heading-element'
import IconElement, { type IconElementProps } from '../components/custom/icon-element'
import ImageElement, { type ImageElementProps } from '../components/custom/image-element'
import ProductCardElement, {
  type ProductCardElementProps,
} from '../components/custom/product-card-element'
import SpacerElement, { type SpacerProps } from '../components/custom/spacer-element'
import TextElement, { type TextProps } from '../components/custom/text-element'
import VideoElement, { type VideoElementProps } from '../components/custom/video-element'
import { CUSTOM_ICON_NAMES } from '../custom-icons'
import { customSectionsContent as copy } from '../data/custom-sections'
import { colourChoice, component, f, labels, px, responsive, yesNo } from './custom-fields'
import { imageField, linkField } from './framed'
import type { SingleProductLoader } from './library'
import { type RichTextFieldEditor, richTextField } from './rich-text-field'

export const ELEMENT_BLOCKS = [
  'Heading',
  'Text',
  'Image',
  'Button',
  'Icon',
  'VideoPlayer',
  'Spacer',
  'Divider',
  'Badge',
  'ProductCard',
  'CustomHtml',
] as const
export type ElementBlockType = (typeof ELEMENT_BLOCKS)[number]

type Options = {
  RichTextEditor?: RichTextFieldEditor | undefined
  loadProduct?: SingleProductLoader | undefined
}

/** The eleven basic elements, usable at the top level or inside any slot. */
export function customElementBlocks(
  options: Options = {},
): Record<ElementBlockType, ComponentConfig> {
  return {
    Heading: component(
      labels.Heading,
      {
        text: { type: 'text', label: f.text },
        level: {
          type: 'select',
          label: f.level,
          options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((h) => ({
            label: h.toUpperCase(),
            value: h,
          })),
        },
      },
      { text: copy.defaults.heading, level: 'h2' },
      ({ puck: _puck, ...props }) => <HeadingElement {...(props as unknown as HeadingProps)} />,
    ),

    Text: component(
      labels.Text,
      { body: richTextField(options.RichTextEditor, f.body) },
      { body: copy.defaults.text },
      ({ puck: _puck, ...props }) => <TextElement {...(props as unknown as TextProps)} />,
    ),

    Image: component(
      labels.Image,
      {
        image: imageField(f.image),
        aspect: {
          type: 'select',
          label: f.aspect,
          options: [
            { label: f.aspectAuto, value: 'auto' },
            { label: f.square, value: '1/1' },
            { label: f.landscape, value: '4/3' },
            { label: f.wide, value: '16/9' },
            { label: f.portrait, value: '3/4' },
          ],
        },
        fit: {
          type: 'radio',
          label: f.fit,
          options: [
            { label: f.cover, value: 'cover' },
            { label: f.contain, value: 'contain' },
          ],
        },
        link: linkField(f.imageLink),
      },
      { image: { url: '', alt: '' }, aspect: '4/3', fit: 'cover', link: { label: '', href: '' } },
      ({ puck: _puck, ...props }) => <ImageElement {...(props as unknown as ImageElementProps)} />,
    ),

    Button: component(
      labels.Button,
      {
        button: linkField(f.button),
        variant: {
          type: 'select',
          label: f.style,
          options: [
            { label: f.primary, value: 'primary' },
            { label: f.secondary, value: 'secondary' },
            { label: f.plain, value: 'plain' },
          ],
        },
        fullWidth: yesNo(f.fullWidth),
      },
      {
        button: { label: copy.defaults.button, href: '/collections/all' },
        variant: 'primary',
        fullWidth: false,
      },
      ({ puck: _puck, ...props }) => (
        <ButtonElement {...(props as unknown as ButtonElementProps)} />
      ),
    ),

    Icon: component(
      labels.Icon,
      {
        icon: {
          type: 'select',
          label: f.icon,
          options: CUSTOM_ICON_NAMES.map((n) => ({
            label: n[0]?.toUpperCase() + n.slice(1),
            value: n,
          })),
        },
        size: px(f.iconSize, 160),
        label: { type: 'text', label: f.iconLabel },
      },
      { icon: 'star', size: 32, label: copy.defaults.iconLabel },
      ({ puck: _puck, ...props }) => <IconElement {...(props as unknown as IconElementProps)} />,
    ),

    VideoPlayer: component(
      labels.VideoPlayer,
      {
        url: { type: 'text', label: f.videoUrl },
        poster: imageField(f.poster),
        title: { type: 'text', label: f.htmlTitle },
      },
      { url: '', poster: { url: '', alt: '' }, title: '' },
      ({ puck: _puck, ...props }) => <VideoElement {...(props as unknown as VideoElementProps)} />,
    ),

    Spacer: component(
      labels.Spacer,
      { height: responsive(f.height, 400) },
      { height: { mobile: 24, tablet: 32, desktop: 48 } },
      ({ puck: _puck, ...props }) => <SpacerElement {...(props as unknown as SpacerProps)} />,
    ),

    Divider: component(
      labels.Divider,
      {
        thickness: px(f.thickness, 16),
        colour: colourChoice(f.lineColour),
        width: { type: 'number', label: f.width, min: 5, max: 100 },
        lineStyle: {
          type: 'select',
          label: f.lineStyle,
          options: [
            { label: f.solid, value: 'solid' },
            { label: f.dashed, value: 'dashed' },
            { label: f.dotted, value: 'dotted' },
          ],
        },
      },
      { thickness: 1, colour: { token: 'inherit', custom: '' }, width: 100, lineStyle: 'solid' },
      ({ puck: _puck, ...props }) => <DividerElement {...(props as unknown as DividerProps)} />,
    ),

    Badge: component(
      labels.Badge,
      {
        text: { type: 'text', label: f.badgeText },
        tone: {
          type: 'select',
          label: f.tone,
          options: [
            { label: f.toneBrand, value: 'brand' },
            { label: f.toneAccent, value: 'accent' },
            { label: f.toneSuccess, value: 'success' },
            { label: f.toneDanger, value: 'danger' },
            { label: f.toneNeutral, value: 'neutral' },
          ],
        },
      },
      { text: copy.defaults.badge, tone: 'brand' },
      ({ puck: _puck, ...props }) => <BadgeElement {...(props as unknown as BadgeProps)} />,
    ),

    ProductCard: component(
      labels.ProductCard,
      { productHandle: { type: 'text', label: f.product } },
      { productHandle: '' },
      ({ puck: _puck, ...props }) => (
        <ProductCardElement {...(props as unknown as ProductCardElementProps)} />
      ),
      {
        resolveData: async ({ props }: { props: Record<string, unknown> }) => {
          const handle = typeof props.productHandle === 'string' ? props.productHandle.trim() : ''
          const resolved = handle && options.loadProduct ? await options.loadProduct(handle) : null
          return { props: { resolved }, readOnly: { resolved: true } }
        },
      } as Partial<ComponentConfig>,
    ),

    CustomHtml: component(
      labels.CustomHtml,
      {
        html: { type: 'textarea', label: f.html },
        title: { type: 'text', label: f.htmlTitle },
      },
      { html: '', title: '' },
      ({ puck, ...props }) => (
        <EmbedElement
          {...(props as unknown as CustomHtmlProps)}
          editing={puck?.isEditing === true}
        />
      ),
    ),
  }
}
