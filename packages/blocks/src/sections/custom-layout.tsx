import type { ComponentConfig } from '@puckeditor/core'
import AccordionBlock, { type AccordionProps } from '../components/custom/accordion-block'
import CarouselBlock, { type CarouselProps } from '../components/custom/carousel-block'
import ColumnsBlock, { COLUMN_PRESETS, type ColumnsProps } from '../components/custom/columns-block'
import GridBlock, { type GridProps } from '../components/custom/grid-block'
import GroupBlock, { type GroupProps } from '../components/custom/group-block'
import TabsBlock, { type TabsProps } from '../components/custom/tabs-block'
import { customSectionsContent as copy } from '../data/custom-sections'
import {
  align,
  colourChoice,
  component,
  f,
  labels,
  px,
  responsive,
  slot,
  yesNo,
} from './custom-fields'
import { imageField, linkField } from './framed'
import { inlineText } from './inline-fields'

export const LAYOUT_BLOCKS = ['Group', 'Columns', 'Grid', 'Tabs', 'Accordion', 'Carousel'] as const
export type LayoutBlockType = (typeof LAYOUT_BLOCKS)[number]

const allColumnPresets = [...new Set(Object.values(COLUMN_PRESETS).flat())]

/** The six layout containers; their content is Puck slots, nestable to any depth. */
export function customLayoutBlocks(): Record<LayoutBlockType, ComponentConfig> {
  return {
    Group: component(
      labels.Group,
      {
        content: slot(f.content),
        direction: {
          type: 'radio',
          label: f.direction,
          options: [
            { label: f.stacked, value: 'column' },
            { label: f.row, value: 'row' },
          ],
        },
        gap: px(f.gap, 120),
        align,
        justify: {
          type: 'select',
          label: f.justify,
          options: [
            { label: f.start, value: 'start' },
            { label: f.center, value: 'center' },
            { label: f.end, value: 'end' },
            { label: f.between, value: 'between' },
          ],
        },
        wrap: yesNo(f.wrap),
        padding: px(f.padding, 200),
        background: colourChoice(f.background),
        backgroundImage: imageField(f.backgroundImage),
        radius: px(f.radius, 64),
        border: yesNo(f.border, f.on, f.off),
        maxWidth: px(f.maxWidth, 2400),
        minHeight: px(f.minHeight, 1600),
        fullBleed: yesNo(f.fullBleed),
        link: linkField(f.link),
      },
      {
        content: [],
        direction: 'column',
        gap: 16,
        align: 'stretch',
        justify: 'start',
        wrap: true,
        padding: 24,
        background: { token: 'inherit', custom: '' },
        backgroundImage: { url: '', alt: '' },
        radius: 0,
        border: false,
        maxWidth: 0,
        minHeight: 0,
        fullBleed: false,
        link: { label: '', href: '' },
      },
      ({ puck, ...props }) => (
        <GroupBlock {...(props as unknown as GroupProps)} editing={puck?.isEditing === true} />
      ),
    ),

    Columns: component(
      labels.Columns,
      {
        columns: {
          type: 'array',
          label: f.columns,
          min: 2,
          max: 4,
          getItemSummary: (_item: unknown, i?: number) => `${f.column} ${(i ?? 0) + 1}`,
          defaultItemProps: { content: [] },
          arrayFields: { content: slot(f.content) },
        },
        layout: {
          type: 'object',
          label: f.columns,
          objectFields: {
            desktop: {
              type: 'select',
              label: f.desktopLayout,
              options: allColumnPresets.map((p) => ({ label: p.replaceAll(':', ' : '), value: p })),
            },
            tablet: {
              type: 'select',
              label: f.tabletLayout,
              options: [
                { label: f.same, value: 'same' },
                { label: f.two, value: 'two' },
                { label: f.stack, value: 'stack' },
              ],
            },
            mobile: {
              type: 'select',
              label: f.mobileLayout,
              options: [
                { label: f.stack, value: 'stack' },
                { label: f.same, value: 'same' },
              ],
            },
          },
        },
        gap: px(f.gap, 120),
        align,
      },
      {
        columns: [{ content: [] }, { content: [] }],
        layout: { desktop: '1:1', tablet: 'same', mobile: 'stack' },
        gap: 24,
        align: 'stretch',
      },
      ({ puck: _puck, ...props }) => <ColumnsBlock {...(props as unknown as ColumnsProps)} />,
    ),

    Grid: component(
      labels.Grid,
      {
        items: slot(f.items),
        columns: responsive(f.gridColumns, 8),
        rows: { type: 'number', label: f.rows, min: 0, max: 12 },
        gap: px(f.gap, 120),
      },
      { items: [], columns: { mobile: 1, tablet: 2, desktop: 3 }, rows: 0, gap: 16 },
      ({ puck: _puck, ...props }) => <GridBlock {...(props as unknown as GridProps)} />,
    ),

    Tabs: component(
      labels.Tabs,
      {
        tabs: {
          type: 'array',
          label: f.tabs,
          min: 1,
          max: 8,
          getItemSummary: (item: { label?: string }, i?: number) =>
            item?.label || copy.defaults.tab((i ?? 0) + 1),
          defaultItemProps: (i: number) => ({ label: copy.defaults.tab(i + 1), content: [] }),
          arrayFields: { label: inlineText(f.tabLabel), content: slot(f.content) },
        },
      },
      {
        tabs: [
          { label: copy.defaults.tab(1), content: [] },
          { label: copy.defaults.tab(2), content: [] },
        ],
      },
      ({ puck: _puck, ...props }) => <TabsBlock {...(props as unknown as TabsProps)} />,
    ),

    Accordion: component(
      labels.Accordion,
      {
        items: {
          type: 'array',
          label: f.items,
          min: 1,
          max: 20,
          getItemSummary: (item: { title?: string }, i?: number) =>
            item?.title || copy.defaults.item((i ?? 0) + 1),
          defaultItemProps: (i: number) => ({
            title: copy.defaults.item(i + 1),
            open: false,
            content: [],
          }),
          arrayFields: {
            title: inlineText(f.title),
            open: yesNo(f.openAtStart),
            content: slot(f.content),
          },
        },
        allowMultiple: yesNo(f.allowMultiple),
      },
      {
        items: [
          { title: copy.defaults.item(1), open: true, content: [] },
          { title: copy.defaults.item(2), open: false, content: [] },
        ],
        allowMultiple: true,
      },
      ({ puck: _puck, ...props }) => <AccordionBlock {...(props as unknown as AccordionProps)} />,
    ),

    Carousel: component(
      labels.Carousel,
      {
        slides: {
          type: 'array',
          label: f.slides,
          min: 1,
          max: 12,
          getItemSummary: (_item: unknown, i?: number) => `${f.slide} ${(i ?? 0) + 1}`,
          defaultItemProps: { content: [] },
          arrayFields: { content: slot(f.content) },
        },
        perView: responsive(f.perView, 6),
        gap: px(f.gap, 120),
      },
      {
        slides: [{ content: [] }, { content: [] }, { content: [] }],
        perView: { mobile: 1, tablet: 2, desktop: 3 },
        gap: 16,
      },
      ({ puck: _puck, ...props }) => <CarouselBlock {...(props as unknown as CarouselProps)} />,
    ),
  }
}
