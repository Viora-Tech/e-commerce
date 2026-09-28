import type { ComponentConfig } from '@puckeditor/core'
import type { AccordionProps } from '../components/custom/accordion-block'
import type { BadgeProps } from '../components/custom/badge-element'
import type { ButtonElementProps } from '../components/custom/button-element'
import type { CarouselProps } from '../components/custom/carousel-block'
import type { ColumnsProps } from '../components/custom/columns-block'
import type { DividerProps } from '../components/custom/divider-element'
import type { CustomHtmlProps } from '../components/custom/embed-element'
import type { GridProps } from '../components/custom/grid-block'
import type { GroupProps } from '../components/custom/group-block'
import type { HeadingProps } from '../components/custom/heading-element'
import type { IconElementProps } from '../components/custom/icon-element'
import type { ImageElementProps } from '../components/custom/image-element'
import type { ProductCardElementProps } from '../components/custom/product-card-element'
import type { SpacerProps } from '../components/custom/spacer-element'
import type { TabsProps } from '../components/custom/tabs-block'
import type { TextProps } from '../components/custom/text-element'
import type { VideoElementProps } from '../components/custom/video-element'
import { customElementBlocks, ELEMENT_BLOCKS, type ElementBlockType } from './custom-elements'
import { customLayoutBlocks, LAYOUT_BLOCKS, type LayoutBlockType } from './custom-layout'
import type { SingleProductLoader } from './library'
import type { RichTextFieldEditor } from './rich-text-field'

export { SLOT_DISALLOW } from './custom-fields'
export { ELEMENT_BLOCKS, LAYOUT_BLOCKS }

export type CustomBlockType = LayoutBlockType | ElementBlockType

export type CustomProps = {
  Group: Omit<GroupProps, 'editing'>
  Columns: ColumnsProps
  Grid: GridProps
  Tabs: TabsProps
  Accordion: AccordionProps
  Carousel: CarouselProps
  Heading: HeadingProps
  Text: TextProps
  Image: ImageElementProps
  Button: ButtonElementProps
  Icon: IconElementProps
  VideoPlayer: VideoElementProps
  Spacer: SpacerProps
  Divider: DividerProps
  Badge: BadgeProps
  ProductCard: ProductCardElementProps
  CustomHtml: Omit<CustomHtmlProps, 'editing'>
}

type Options = {
  RichTextEditor?: RichTextFieldEditor | undefined
  loadProduct?: SingleProductLoader | undefined
}

/**
 * Build-your-own blocks: six layout containers whose content is Puck slots
 * (nestable, drag in and out, each child a normal block) and eleven basic
 * elements. Every one carries the `style` panel (`../element-style.ts`).
 */
export function customSections(options: Options = {}): Record<CustomBlockType, ComponentConfig> {
  return { ...customLayoutBlocks(), ...customElementBlocks(options) }
}
