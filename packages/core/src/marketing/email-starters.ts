/** SOURCE OF TRUTH: ready-made email templates — WHAT: the campaign builder's starter designs (sales, launches, loyalty, festivals, updates) as MJML in the store's own logo, colour and products / WHY: a merchant starts a campaign from a finished, on-brand email instead of a blank canvas */

import { escapeHtml } from './email'
import {
  discountMjml,
  type EmailBrand,
  type EmailProductCard,
  footerMjml,
  logoMjml,
  productGridMjml,
  socialMjml,
} from './email-design'

export const EMAIL_STARTER_CATEGORIES = [
  'sales',
  'launches',
  'loyalty',
  'festivals',
  'updates',
] as const
export type EmailStarterCategory = (typeof EMAIL_STARTER_CATEGORIES)[number]

export type StarterContext = {
  brand: EmailBrand
  /** The store's newest active products with a photo; the starters show up to three. */
  products: EmailProductCard[]
  labels: { reason: string; unsubscribe: string; shopNow: string }
}

type Starter = {
  id: string
  category: EmailStarterCategory
  build: (ctx: StarterContext) => string
}

const COLOUR = /^#[0-9a-f]{3,8}$/i
const pick = (c: string, fallback: string) => (COLOUR.test(c) ? c : fallback)
const PANEL = '#f6f5f2'
const INK = '#161615'
const BODY = '#55534d'
const e = escapeHtml

function colours(brand: EmailBrand) {
  return { bg: pick(brand.colours.button, INK), fg: pick(brand.colours.buttonText, '#ffffff') }
}

/** Plus Jakarta Sans where the inbox loads web fonts, the system stack everywhere else. */
const HEAD = `<mj-head><mj-font name="Plus Jakarta Sans" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&amp;display=swap" /><mj-attributes><mj-all font-family="'Plus Jakarta Sans', Helvetica, Arial, sans-serif" /><mj-section background-color="#ffffff" /><mj-text color="${BODY}" font-size="15px" line-height="1.6" /></mj-attributes></mj-head>`

function shell(ctx: StarterContext, body: string): string {
  return `<mjml>${HEAD}<mj-body background-color="${PANEL}" width="600px">${logoMjml(ctx.brand)}${nav()}${body}${socialMjml(ctx.brand)}${footerMjml(ctx.brand, ctx.labels)}</mj-body></mjml>`
}

function nav(): string {
  const link = (label: string, path: string) =>
    `<a href="{shop_url}${path}" style="color:${BODY};text-decoration:none">${label}</a>`
  return `<mj-section padding="0 24px 6px"><mj-column><mj-text align="center" font-size="13px" padding="0 0 16px">${link('Shop', '')} &nbsp;·&nbsp; ${link('New in', '/collections/all')} &nbsp;·&nbsp; ${link('Track order', '/track-order')}</mj-text><mj-divider border-width="1px" border-color="#eeede9" padding="0" /></mj-column></mj-section>`
}

/** The full-colour block with a small label, a huge title and one line; flat colour only. */
function hero(
  ctx: StarterContext,
  h: { eyebrow: string; title: string; line?: string; dark?: boolean },
): string {
  const c = h.dark ? { bg: INK, fg: '#ffffff' } : colours(ctx.brand)
  const line = h.line
    ? `<mj-text align="center" color="${c.fg}" font-size="15px" line-height="1.55" padding="0">${e(h.line)}</mj-text>`
    : ''
  return `<mj-section padding="20px 24px 0"><mj-column background-color="${c.bg}" border-radius="22px" padding="40px 24px"><mj-text align="center" color="${c.fg}" font-size="12px" font-weight="700" letter-spacing="2px" text-transform="uppercase" padding="0 0 12px">${e(h.eyebrow)}</mj-text><mj-text align="center" color="${c.fg}" font-size="46px" line-height="1" font-weight="800" letter-spacing="-1.5px" text-transform="uppercase" padding="0 0 14px">${e(h.title)}</mj-text>${line}</mj-column></mj-section>`
}

function greet(heading: string, body: string): string {
  return `<mj-section padding="30px 32px 0"><mj-column><mj-text align="center" color="${INK}" font-size="22px" font-weight="700" line-height="1.3" padding="0 0 10px">${e(heading)}</mj-text><mj-text align="center" padding="0">${e(body)}</mj-text></mj-column></mj-section>`
}

/** The one button: brand colour, centred (owner rule, 3 Nov 2026). */
function button(ctx: StarterContext, label: string, path = ''): string {
  const c = colours(ctx.brand)
  return `<mj-section padding="22px 24px 4px"><mj-column><mj-button href="{shop_url}${path}" align="center" background-color="${c.bg}" color="${c.fg}" border-radius="12px" font-size="15px" font-weight="700" inner-padding="16px 34px">${e(label)}</mj-button></mj-column></mj-section>`
}

function heading(text: string): string {
  return `<mj-section padding="30px 24px 6px"><mj-column><mj-text align="center" color="${INK}" font-size="20px" font-weight="800" padding="0">${e(text)}</mj-text></mj-column></mj-section>`
}

function products(ctx: StarterContext, count = 3): string {
  const items = ctx.products.slice(0, count)
  if (items.length === 0) return ''
  const columns = (items.length >= 3 ? 3 : items.length) as 1 | 2 | 3
  return productGridMjml(items, ctx.brand, { columns, buttonLabel: ctx.labels.shopNow })
}

function strip(text: string): string {
  return `<mj-section padding="24px 24px 0"><mj-column background-color="${PANEL}" border-radius="14px" padding="14px"><mj-text align="center" font-size="14px" color="${BODY}" padding="0">${e(text)}</mj-text></mj-column></mj-section>`
}

function coupon(ctx: StarterContext, code: string, title: string, note: string): string {
  return `<mj-wrapper padding="22px 0 0">${discountMjml({ code, heading: title, note }, ctx.brand)}</mj-wrapper>`
}

/** Three quick promises in one row; edit or delete it in the builder. */
function perks(items: [string, string][]): string {
  const cols = items
    .map(
      ([t, d]) =>
        `<mj-column><mj-text align="center" font-size="13px" color="${BODY}" padding="4px"><strong style="color:${INK}">${e(t)}</strong><br />${e(d)}</mj-text></mj-column>`,
    )
    .join('')
  return `<mj-section padding="26px 24px 0" border-top="1px solid #eeede9">${cols}</mj-section>`
}

const STARTERS: Starter[] = [
  // Sales
  {
    id: 'festive-sale',
    category: 'sales',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'The festive sale is live',
          title: 'Up to 40% off',
          line: 'On everything you have been eyeing. No code needed, prices already cut.',
        }) +
          button(ctx, 'Shop the sale', '/collections/all') +
          heading('Biggest drops') +
          products(ctx) +
          strip('Free shipping on every order this week. Cash on delivery available.'),
      ),
  },
  {
    id: 'flash-sale',
    category: 'sales',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Flash sale · today only',
          title: '25% off everything',
          line: 'Use code FLASH25 at checkout. Ends at midnight tonight.',
          dark: true,
        }) +
          button(ctx, 'Shop before midnight', '/collections/all') +
          products(ctx),
      ),
  },
  {
    id: 'end-of-season',
    category: 'sales',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'End of season',
          title: 'Last call',
          line: 'Final prices on this season. Once they are gone, they are gone.',
        }) +
          greet(
            'Hi {first_name}, this is the final markdown',
            'Stock is limited and we will not restock these.',
          ) +
          button(ctx, 'Shop the sale', '/collections/all') +
          products(ctx),
      ),
  },
  {
    id: 'price-drop',
    category: 'sales',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Price drop',
          title: 'Now for less',
          line: 'Some of our favourites just got cheaper.',
        }) +
          products(ctx) +
          button(ctx, 'See all new prices', '/collections/all'),
      ),
  },
  {
    id: 'free-shipping',
    category: 'sales',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'This weekend only',
          title: 'Free shipping',
          line: 'On every order, anywhere in India. No minimum.',
        }) +
          button(ctx, 'Start shopping') +
          heading('Popular right now') +
          products(ctx),
      ),
  },
  // Launches
  {
    id: 'new-launch',
    category: 'launches',
    build: (ctx) => {
      const first = ctx.products[0]
      return shell(
        ctx,
        hero(ctx, {
          eyebrow: 'New launch',
          title: first ? first.title : 'Just dropped',
          line: 'Made for everyday use. Be among the first to get it.',
        }) +
          products(ctx, 1) +
          greet(
            'Why you will love it',
            'Tell your customers the three things that make this product special.',
          ) +
          button(ctx, 'Shop now', first ? `/products/${encodeURIComponent(first.handle)}` : ''),
      )
    },
  },
  {
    id: 'new-arrivals',
    category: 'launches',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'New this week',
          title: 'Fresh arrivals',
          line: 'The latest additions to {store_name}, picked for you.',
        }) +
          products(ctx) +
          button(ctx, 'See everything new', '/collections/all'),
      ),
  },
  {
    id: 'back-in-stock',
    category: 'launches',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Back in stock',
          title: "It's back",
          line: 'Our most-asked-for products are back. Last time they sold out in days.',
        }) +
          products(ctx) +
          button(ctx, 'Shop before it sells out', '/collections/all'),
      ),
  },
  {
    id: 'bestsellers',
    category: 'launches',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Customer favourites',
          title: 'Our bestsellers',
          line: 'The products our customers order again and again.',
        }) +
          products(ctx) +
          perks([
            ['Quality checked', 'Every order'],
            ['Easy returns', 'Within 7 days'],
            ['UPI & COD', 'Pay your way'],
          ]) +
          button(ctx, 'Shop bestsellers', '/collections/all'),
      ),
  },
  // Loyalty
  {
    id: 'coupon-for-you',
    category: 'loyalty',
    build: (ctx) =>
      shell(
        ctx,
        greet(
          "Here's ₹500 off, just for you",
          'Thanks for being one of our regulars, {first_name}. Use this on anything in the store.',
        ) +
          coupon(ctx, 'THANKYOU500', 'Your code', 'Valid for 14 days on orders above ₹1,999') +
          button(ctx, 'Use my code') +
          heading('Picked for you') +
          products(ctx),
      ),
  },
  {
    id: 'win-back',
    category: 'loyalty',
    build: (ctx) =>
      shell(
        ctx,
        greet(
          "It's been a while, {first_name}",
          'A lot has changed since your last order. New products, new colours, and a little gift to welcome you back.',
        ) +
          coupon(ctx, 'COMEBACK15', 'Welcome back gift', '15% off, ends in 7 days') +
          button(ctx, "See what's new", '/collections/all') +
          heading('New since your last visit') +
          products(ctx),
      ),
  },
  {
    id: 'birthday',
    category: 'loyalty',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Happy birthday, {first_name}',
          title: 'A gift for you',
          line: 'Celebrate with something you love, on us.',
        }) +
          coupon(ctx, 'BDAY20', 'Your birthday code', '20% off anything, valid all month') +
          button(ctx, 'Treat yourself'),
      ),
  },
  {
    id: 'thank-you',
    category: 'loyalty',
    build: (ctx) =>
      shell(
        ctx,
        greet(
          'Thank you for shopping with us',
          "{first_name}, small brands like {store_name} grow because of customers like you. Here's early access to our next drop.",
        ) +
          button(ctx, 'Get early access', '/collections/all') +
          products(ctx),
      ),
  },
  {
    id: 'reviews',
    category: 'loyalty',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Loved by customers',
          title: '4.8 out of 5',
          line: 'Do not take our word for it. Here is what customers say.',
        }) +
          greet(
            '"Exactly as shown, and it arrived in two days."',
            "Add your favourite reviews here, with the customer's first name and city.",
          ) +
          products(ctx) +
          button(ctx, 'Shop the favourites', '/collections/all'),
      ),
  },
  // Festivals
  {
    id: 'diwali',
    category: 'festivals',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Happy Diwali',
          title: 'Festival of lights sale',
          line: 'Gifts for everyone on your list, up to 40% off.',
        }) +
          button(ctx, 'Shop Diwali gifts', '/collections/all') +
          products(ctx) +
          strip('Order by the 25th for delivery before Diwali.'),
      ),
  },
  {
    id: 'holi',
    category: 'festivals',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Happy Holi',
          title: 'Bring on the colour',
          line: 'Celebrate with 20% off everything. Code HOLI20.',
        }) +
          button(ctx, 'Shop the Holi sale', '/collections/all') +
          products(ctx),
      ),
  },
  {
    id: 'rakhi',
    category: 'festivals',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Raksha Bandhan',
          title: 'Gifts for your sibling',
          line: 'Thoughtful picks, gift-wrapped and delivered in time.',
        }) +
          products(ctx) +
          button(ctx, 'Shop Rakhi gifts', '/collections/all'),
      ),
  },
  {
    id: 'independence-day',
    category: 'festivals',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Independence Day',
          title: 'Freedom sale',
          line: 'Made in India, for India. 15% off till 15 August.',
        }) +
          button(ctx, 'Shop the sale', '/collections/all') +
          products(ctx),
      ),
  },
  {
    id: 'new-year',
    category: 'festivals',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, {
          eyebrow: 'Happy New Year',
          title: 'New year, new gear',
          line: 'Start the year with 20% off. Code NEWYEAR20.',
          dark: true,
        }) +
          button(ctx, 'Shop the new year sale', '/collections/all') +
          products(ctx),
      ),
  },
  // Updates
  {
    id: 'announcement',
    category: 'updates',
    build: (ctx) =>
      shell(
        ctx,
        hero(ctx, { eyebrow: 'News from {store_name}', title: 'Big news' }) +
          greet(
            'Hi {first_name}, we have something to tell you',
            'Write your announcement here: a new store, a new collection, a change your customers should know about.',
          ) +
          button(ctx, 'Find out more'),
      ),
  },
]

/** Every ready-made template, built for this store. */
export function emailStarters(
  ctx: StarterContext,
): { id: string; category: EmailStarterCategory; mjml: string }[] {
  return STARTERS.map((s) => ({ id: s.id, category: s.category, mjml: s.build(ctx) }))
}
