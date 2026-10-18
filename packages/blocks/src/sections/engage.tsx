import type { ComponentConfig } from '@puckeditor/core'
import OffersStrip from '../components/sections/offers-strip'
import ProductLaunch from '../components/sections/product-launch'
import SaleCountdown from '../components/sections/sale-countdown'
import StoreLocator from '../components/sections/store-locator'
import { modernSectionsContent as copy } from '../data/modern-sections'
import { type Frame, framed, inlineLinkField, type Link } from './framed'
import { inlineText } from './inline-fields'

const heading = inlineText('Heading')

export type EngageProps = {
  ProductLaunch: Frame & {
    badge: string
    heading: string
    text: string
    launchAt: string
    notifyButton: string
    liveHeading: string
    liveButton: Link
  }
  SaleCountdown: Frame & {
    badge: string
    heading: string
    codeText: string
    code: string
    endsAt: string
    button: Link
  }
  OffersStrip: Frame & {
    heading: string
    offers: { icon: string; title: string; text: string; link: Link }[]
  }
  StoreLocator: Frame & {
    kicker: string
    heading: string
    stores: { name: string; address: string; hours: string }[]
  }
}

/**
 * Figma Sections · 4 and 6 "NEW" sections: the sale countdown, the offers strip (no-cost EMI,
 * bank offers, UPI cashback) and the store locator. Built like `./modern.tsx`: `framed()`
 * wraps each in the shared section settings.
 */
export function engageSections(): Record<keyof EngageProps, ComponentConfig> {
  return {
    ProductLaunch: framed<EngageProps['ProductLaunch']>(
      'Product launch',
      {
        badge: inlineText('Tag'),
        heading,
        text: inlineText('Text'),
        launchAt: { type: 'text', label: 'Launch time (e.g. 2026-11-05T19:00+05:30)' },
        notifyButton: inlineText('Notify button'),
        liveHeading: inlineText('Heading once live'),
        liveButton: inlineLinkField('Button once live'),
      },
      {
        badge: copy.productLaunch.badge,
        heading: copy.productLaunch.heading,
        text: copy.productLaunch.text,
        launchAt: '',
        notifyButton: copy.productLaunch.notifyButton,
        liveHeading: copy.productLaunch.liveHeading,
        liveButton: { label: copy.productLaunch.liveButton, href: '/collections/all' },
      },
      // The storefront's sign-up arrives as section metadata, as for the newsletter.
      (p, meta) => <ProductLaunch {...p} action={meta.newsletterAction} />,
    ),

    SaleCountdown: framed<EngageProps['SaleCountdown']>(
      'Sale countdown',
      {
        badge: inlineText('Tag'),
        heading,
        codeText: inlineText('Line before the code'),
        code: { type: 'text', label: 'Discount code (blank hides it)' },
        endsAt: { type: 'text', label: 'Sale ends (e.g. 2026-11-05T23:59+05:30)' },
        button: inlineLinkField(),
      },
      {
        badge: copy.saleCountdown.badge,
        heading: copy.saleCountdown.heading,
        codeText: copy.saleCountdown.codeText,
        code: copy.saleCountdown.code,
        endsAt: '',
        button: { label: copy.saleCountdown.button, href: '/collections/all' },
      },
      (p) => <SaleCountdown {...p} />,
    ),

    OffersStrip: framed<EngageProps['OffersStrip']>(
      'Offers strip',
      {
        heading,
        offers: {
          type: 'array',
          label: 'Offers',
          max: 4,
          getItemSummary: (o: { title?: string }) => o.title || 'Offer',
          arrayFields: {
            icon: { type: 'select', label: 'Icon', options: [...copy.offersStrip.icons] },
            title: inlineText('Title'),
            text: inlineText('Text'),
            link: inlineLinkField('Link'),
          },
        },
      },
      {
        heading: copy.offersStrip.heading,
        offers: copy.offersStrip.offers.map((o) => ({
          ...o,
          link: { label: copy.offersStrip.details, href: '/pages/offers' },
        })),
      },
      (p) => <OffersStrip heading={p.heading} offers={p.offers} />,
    ),

    StoreLocator: framed<EngageProps['StoreLocator']>(
      'Store locator',
      {
        kicker: inlineText('Eyebrow'),
        heading,
        stores: {
          type: 'array',
          label: 'Stores',
          getItemSummary: (s: { name?: string }) => s.name || 'Store',
          arrayFields: {
            name: inlineText('Name'),
            address: { type: 'textarea', label: 'Address (used for the map and directions)' },
            hours: inlineText('Hours (e.g. Open · closes 9pm)'),
          },
        },
      },
      {
        kicker: copy.storeLocator.kicker,
        heading: copy.storeLocator.heading,
        stores: copy.storeLocator.stores.map((s) => ({ ...s })),
      },
      (p) => <StoreLocator kicker={p.kicker} heading={p.heading} stores={p.stores} />,
    ),
  }
}
