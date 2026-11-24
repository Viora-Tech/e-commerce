/** SOURCE OF TRUTH: the Loyalty points app's storefront embeds and blocks — WHAT: the "Loyalty widget" and "Referral pop-up" app embeds (theme editor → App embeds) and the "Points on product" and "Redeem in cart" app blocks, with their settings / WHY: the manifest (`app.ts`) and the admin editor's client-safe mirror (`commerce.blocks.config.ts`) attach the same arrays; no database import here, so the editor's browser bundle can import it (`@commerce/core/loyalty-blocks`) */
import {
  LOYALTY_WIDGET_DEFAULTS,
  LoyaltyCartRedeem,
  LoyaltyLauncher,
  LoyaltyPricePoints,
  LoyaltyProductPoints,
  LoyaltyReferralPopup,
} from '@commerce/blocks/loyalty'
import type { AppBlockDefinition, AppEmbedDefinition } from '@commerce/plugins'
import { LOYALTY_APP_ID } from './settings'

export const LOYALTY_WIDGET = `${LOYALTY_APP_ID}/Widget`
export const LOYALTY_REFERRAL_POPUP = `${LOYALTY_APP_ID}/ReferralPopup`

/** What the storefront hands a loyalty embed (`apps/storefront/src/lib/app-embed-data.ts`). */
export type LoyaltyEmbedData = { storeName: string; signedIn: boolean }

type EmbedProps = Record<string, unknown> & { data?: LoyaltyEmbedData | null | undefined }

type BlockProps = Record<string, unknown> & {
  puck?: { isEditing?: boolean; metadata?: { appBlockContext?: Record<string, unknown> } }
}

const yesNo = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
]

const colourHelp = 'A hex colour, for example #1f2937'

const headerFields = {
  headerColor: { type: 'text', label: 'Header colour', placeholder: colourHelp },
  headerGradient: {
    type: 'text',
    label: 'Header gradient to (leave empty for one colour)',
    placeholder: colourHelp,
  },
  headerText: { type: 'text', label: 'Header text colour', placeholder: colourHelp },
}

export const loyaltyEmbeds: AppEmbedDefinition[] = [
  {
    type: LOYALTY_WIDGET,
    label: 'Loyalty widget',
    description:
      'A rewards button on every page. Shoppers join, see their points, claim rewards and share their referral link.',
    fields: {
      title: { type: 'text', label: 'Program name (empty: your store name + Rewards)' },
      layout: {
        type: 'radio',
        label: 'Opens as',
        options: [
          { label: 'Pop-up', value: 'popup' },
          { label: 'Side panel', value: 'sidebar' },
        ],
      },
      position: {
        type: 'radio',
        label: 'Side of the screen',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      ...headerFields,
      launcherText: { type: 'text', label: 'Button text' },
      launcherIcon: {
        type: 'select',
        label: 'Button icon',
        options: [
          { label: 'Gift', value: 'gift' },
          { label: 'Star', value: 'star' },
          { label: 'Crown', value: 'crown' },
          { label: 'Heart', value: 'heart' },
          { label: 'No icon', value: 'none' },
        ],
      },
      cardPoints: {
        type: 'radio',
        label: 'Show "Earn N points" under product card prices',
        options: yesNo,
      },
      priceSelector: {
        type: 'text',
        label: 'Imported theme: CSS selector of the prices to add points under',
        placeholder: '.card-information .price',
      },
    },
    defaultProps: LOYALTY_WIDGET_DEFAULTS,
    render: (props: EmbedProps) => (
      <LoyaltyLauncher
        settings={props}
        storeName={props.data?.storeName ?? ''}
        signedIn={props.data?.signedIn === true}
        live={Boolean(props.data)}
      />
    ),
  },
  {
    type: LOYALTY_REFERRAL_POPUP,
    label: 'Referral pop-up',
    description:
      'When someone opens a member’s referral link, a pop-up shows the friend’s offer and gives them their code.',
    fields: {
      heading: { type: 'text', label: 'Heading (empty: A friend sent you a gift)' },
      ...headerFields,
    },
    defaultProps: {
      heading: '',
      headerColor: LOYALTY_WIDGET_DEFAULTS.headerColor,
      headerGradient: '',
      headerText: LOYALTY_WIDGET_DEFAULTS.headerText,
    },
    render: (props: EmbedProps) => (
      <LoyaltyReferralPopup
        settings={props}
        heading={typeof props.heading === 'string' ? props.heading : ''}
        live={Boolean(props.data)}
      />
    ),
  },
]

/** The product page's price for the points line (`appBlockContext.loyalty`). */
function productPrice(props: BlockProps): number | null {
  const ctx = props.puck?.metadata?.appBlockContext?.loyalty as
    | { pricePaise?: number | null }
    | undefined
  return typeof ctx?.pricePaise === 'number' ? ctx.pricePaise : null
}

export const loyaltyBlocks: AppBlockDefinition[] = [
  {
    type: `${LOYALTY_APP_ID}/ProductPoints`,
    label: 'Points on product',
    description:
      '"Earn N points with this order" on the product page; visitors see "Join to earn".',
    icon: 'Gift',
    fields: {
      look: {
        type: 'radio',
        label: 'Look',
        options: [
          { label: 'A line of text', value: 'line' },
          { label: 'A soft box', value: 'card' },
        ],
      },
    },
    defaultProps: { look: 'line' },
    render: (props: BlockProps) => (
      <LoyaltyProductPoints
        pricePaise={productPrice(props)}
        look={props.look === 'card' ? 'card' : 'line'}
      />
    ),
  },
  {
    type: `${LOYALTY_APP_ID}/ProductCardPoints`,
    label: 'Points on product card',
    description:
      'Add it to a collection, search or home page: every product card there gets "Earn N points" under its price.',
    icon: 'Gift',
    fields: {},
    defaultProps: {},
    render: (props: BlockProps) =>
      props.puck?.isEditing === true ? null : <LoyaltyPricePoints selector="" ownCards />,
  },
  {
    type: `${LOYALTY_APP_ID}/CartRedeem`,
    label: 'Redeem in cart',
    description: 'The shopper’s points and the rewards that fit the cart, applied in one click.',
    icon: 'Gift',
    fields: { heading: { type: 'text', label: 'Heading (empty: Use your points)' } },
    defaultProps: { heading: '' },
    render: (props: BlockProps) => (
      <LoyaltyCartRedeem
        heading={typeof props.heading === 'string' ? props.heading : ''}
        live={props.puck?.isEditing !== true}
      />
    ),
  },
]
