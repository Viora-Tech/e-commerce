import type { ComponentConfig } from '@puckeditor/core'
import ComparisonTable from '../components/sections/kit/comparison-table'
import FaqSplit from '../components/sections/kit/faq-split'
import FeatureCards from '../components/sections/kit/feature-cards'
import FeatureChecklist from '../components/sections/kit/feature-checklist'
import FeatureSteps from '../components/sections/kit/feature-steps'
import PricingCards from '../components/sections/kit/pricing-cards'
import TestimonialGrid from '../components/sections/kit/testimonial-grid'
import TestimonialSpotlight from '../components/sections/kit/testimonial-spotlight'
import { kitSectionsContent as copy } from '../data/kit-sections'
import {
  type Frame,
  framed,
  type Image,
  imageField,
  inlineLinkField,
  type Link,
  noImage,
} from './framed'
import { inlineRichtext, inlineText, inlineTextarea } from './inline-fields'
import { f, ICONS, sideField, summary, yesNo } from './kit-fields'

export type KitTrustProps = {
  FeatureCards: Frame & {
    heading: string
    text: string
    columns: 2 | 3
    items: { icon: string; title: string; text: string }[]
  }
  FeatureSteps: Frame & { heading: string; text: string; steps: { title: string; text: string }[] }
  FeatureChecklist: Frame & {
    eyebrow: string
    heading: string
    text: string
    points: { text: string }[]
    primary: Link
    image: Image
    imageSide: 'left' | 'right'
  }
  TestimonialGrid: Frame & {
    heading: string
    text: string
    quotes: { quote: string; author: string; role: string; rating: number }[]
  }
  TestimonialSpotlight: Frame & { quote: string; author: string; role: string; photo: Image }
  FaqSplit: Frame & {
    heading: string
    text: string
    contactHeading: string
    contact: Link
    items: { question: string; answer: string }[]
  }
  ComparisonTable: Frame & {
    heading: string
    text: string
    ours: string
    theirs: string
    rows: { feature: string; ours: boolean; theirs: boolean }[]
  }
  PricingCards: Frame & {
    heading: string
    text: string
    highlightLabel: string
    plans: {
      name: string
      price: string
      period: string
      features: string
      button: Link
      highlight: boolean
    }[]
  }
}

/**
 * Starter kit, batch 2: the sections that build trust (features, steps, testimonials, FAQ,
 * comparison, plans). Same rules as `./kit.tsx`.
 */
export function kitTrustSections(): Record<keyof KitTrustProps, ComponentConfig> {
  return {
    FeatureCards: framed<KitTrustProps['FeatureCards']>(
      copy.labels.featureCards,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        columns: {
          type: 'radio',
          label: f.columns,
          options: [
            { label: '2', value: 2 },
            { label: '3', value: 3 },
          ],
        },
        items: {
          type: 'array',
          label: f.items,
          max: 9,
          arrayFields: {
            icon: { type: 'select', label: f.icon, options: ICONS },
            title: inlineText(f.title),
            text: inlineTextarea(f.text),
          },
          defaultItemProps: { icon: 'check', title: '', text: '' },
          getItemSummary: (item: { title?: unknown }) => summary(item.title, f.item),
        },
      },
      {
        heading: copy.featureCards.heading,
        text: copy.featureCards.text,
        columns: 3,
        items: copy.featureCards.items.map((item) => ({ ...item })),
      },
      (p) => <FeatureCards {...p} />,
    ),

    FeatureSteps: framed<KitTrustProps['FeatureSteps']>(
      copy.labels.featureSteps,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        steps: {
          type: 'array',
          label: f.steps,
          max: 5,
          arrayFields: { title: inlineText(f.title), text: inlineTextarea(f.text) },
          defaultItemProps: { title: '', text: '' },
          getItemSummary: (item: { title?: unknown }) => summary(item.title, f.step),
        },
      },
      {
        heading: copy.featureSteps.heading,
        text: copy.featureSteps.text,
        steps: copy.featureSteps.steps.map((step) => ({ ...step })),
      },
      (p) => <FeatureSteps {...p} />,
    ),

    FeatureChecklist: framed<KitTrustProps['FeatureChecklist']>(
      copy.labels.featureChecklist,
      {
        eyebrow: inlineText(f.eyebrow),
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        points: {
          type: 'array',
          label: f.points,
          max: 8,
          arrayFields: { text: inlineText(f.point) },
          defaultItemProps: { text: '' },
          getItemSummary: (item: { text?: unknown }) => summary(item.text, f.point),
        },
        primary: inlineLinkField(f.primary),
        image: imageField(f.image),
        imageSide: sideField,
      },
      {
        eyebrow: copy.featureChecklist.eyebrow,
        heading: copy.featureChecklist.heading,
        text: copy.featureChecklist.text,
        points: copy.featureChecklist.points.map((text) => ({ text })),
        primary: { label: copy.featureChecklist.primary, href: '/collections/all' },
        image: noImage,
        imageSide: 'left',
      },
      (p) => <FeatureChecklist {...p} />,
    ),

    TestimonialGrid: framed<KitTrustProps['TestimonialGrid']>(
      copy.labels.testimonialGrid,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        quotes: {
          type: 'array',
          label: f.quotes,
          max: 12,
          arrayFields: {
            quote: inlineTextarea(f.quote),
            author: inlineText(f.author),
            role: inlineText(f.role),
            rating: { type: 'number', label: f.rating, min: 0, max: 5 },
          },
          defaultItemProps: { quote: '', author: '', role: '', rating: 5 },
          getItemSummary: (item: { author?: unknown }) => summary(item.author, f.quote),
        },
      },
      {
        heading: copy.testimonialGrid.heading,
        text: copy.testimonialGrid.text,
        quotes: copy.testimonialGrid.quotes.map((q) => ({ ...q })),
      },
      (p) => <TestimonialGrid {...p} starsLabel={copy.a11y.stars} />,
    ),

    TestimonialSpotlight: framed<KitTrustProps['TestimonialSpotlight']>(
      copy.labels.testimonialSpotlight,
      {
        quote: inlineTextarea(f.quote),
        author: inlineText(f.author),
        role: inlineText(f.role),
        photo: imageField(f.image),
      },
      {
        quote: copy.testimonialSpotlight.quote,
        author: copy.testimonialSpotlight.author,
        role: copy.testimonialSpotlight.role,
        photo: noImage,
      },
      (p) => <TestimonialSpotlight {...p} />,
    ),

    FaqSplit: framed<KitTrustProps['FaqSplit']>(
      copy.labels.faqSplit,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        contactHeading: inlineText(f.contactHeading),
        contact: inlineLinkField(f.contactButton),
        items: {
          type: 'array',
          label: f.questions,
          max: 20,
          arrayFields: { question: inlineText(f.question), answer: inlineRichtext(f.answer) },
          defaultItemProps: { question: '', answer: '' },
          getItemSummary: (item: { question?: unknown }) => summary(item.question, f.question),
        },
      },
      {
        heading: copy.faqSplit.heading,
        text: copy.faqSplit.text,
        contactHeading: copy.faqSplit.contactHeading,
        contact: { label: copy.faqSplit.contactButton, href: '/pages/contact' },
        items: copy.faqSplit.items.map((item) => ({ ...item })),
      },
      (p, _meta, editing) => <FaqSplit {...p} editing={editing} />,
    ),

    ComparisonTable: framed<KitTrustProps['ComparisonTable']>(
      copy.labels.comparisonTable,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        ours: inlineText(f.ours),
        theirs: inlineText(f.theirs),
        rows: {
          type: 'array',
          label: f.rows,
          max: 15,
          arrayFields: {
            feature: inlineText(f.feature),
            ours: yesNo(f.oursHas),
            theirs: yesNo(f.theirsHas),
          },
          defaultItemProps: { feature: '', ours: true, theirs: false },
          getItemSummary: (item: { feature?: unknown }) => summary(item.feature, f.row),
        },
      },
      {
        heading: copy.comparisonTable.heading,
        text: copy.comparisonTable.text,
        ours: copy.comparisonTable.ours,
        theirs: copy.comparisonTable.theirs,
        rows: copy.comparisonTable.rows.map((row) => ({ ...row })),
      },
      (p) => <ComparisonTable {...p} yes={copy.a11y.included} no={copy.a11y.notIncluded} />,
    ),

    PricingCards: framed<KitTrustProps['PricingCards']>(
      copy.labels.pricingCards,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        highlightLabel: inlineText(f.highlightLabel),
        plans: {
          type: 'array',
          label: f.plans,
          max: 4,
          arrayFields: {
            name: inlineText(f.name),
            price: inlineText(f.price),
            period: inlineText(f.period),
            features: inlineTextarea(f.features),
            button: inlineLinkField(f.button),
            highlight: yesNo(f.highlight),
          },
          defaultItemProps: {
            name: '',
            price: '',
            period: '',
            features: '',
            button: { label: '', href: '/collections/all' },
            highlight: false,
          },
          getItemSummary: (item: { name?: unknown }) => summary(item.name, f.plan),
        },
      },
      {
        heading: copy.pricingCards.heading,
        text: copy.pricingCards.text,
        highlightLabel: copy.pricingCards.highlightLabel,
        plans: copy.pricingCards.plans.map(({ button, ...plan }) => ({
          ...plan,
          button: { label: button, href: '/collections/all' },
        })),
      },
      (p) => <PricingCards {...p} />,
    ),
  }
}
