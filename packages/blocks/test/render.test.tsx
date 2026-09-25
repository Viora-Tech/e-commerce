import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildAppBlocks } from '../src/app-blocks'
import DeliveryCheckerBlock, {
  type DeliveryCheckerCopy,
} from '../src/app-blocks/delivery-checker-block'
import NotifyMeBlock, { type NotifyMeBlockCopy } from '../src/app-blocks/notify-me-block'
import PreorderCountdownBlock from '../src/app-blocks/preorder-countdown-block'

const notifyCopy: NotifyMeBlockCopy = {
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  whatsappLabel: 'WhatsApp',
  whatsappPlaceholder: '98765 43210',
  consent: 'consent',
  submitting: 'Sending…',
  doneEmail: 'done',
  errorGeneric: 'error',
  errorRateLimited: 'rate limited',
}

const deliveryCopy: DeliveryCheckerCopy = {
  heading: 'Check delivery',
  placeholder: 'PIN code',
  button: 'Check',
  checking: 'Checking…',
  change: 'Change',
  deliversBy: (r) => `Delivery by ${r}`,
  dispatchToday: 'today',
  dispatchOn: (d) => `on ${d}`,
  cod: 'cod',
  prepaidOnly: 'prepaid',
  fallback: 'fallback',
  unserviceable: (p) => `no ${p}`,
}

describe('app block components render with default/idle props', () => {
  it('NotifyMeBlock draws nothing without a product context', () => {
    const html = renderToStaticMarkup(
      <NotifyMeBlock
        buttonLabel="Notify me"
        helperText="helper"
        align="left"
        context={undefined}
        copy={notifyCopy}
      />,
    )
    expect(html).toBe('')
  })

  it('NotifyMeBlock draws the form when the variant is out of stock', () => {
    const html = renderToStaticMarkup(
      <NotifyMeBlock
        buttonLabel="Notify me"
        helperText="helper"
        align="left"
        context={{
          variantId: 'v1',
          available: 0,
          isPreorder: false,
          whatsappEnabled: false,
          action: async () => ({ status: 'idle' }),
        }}
        copy={notifyCopy}
      />,
    )
    expect(html).toContain('Notify me')
  })

  it('PreorderCountdownBlock draws nothing when not on pre-order', () => {
    const html = renderToStaticMarkup(
      <PreorderCountdownBlock label="Launches in" style="compact" context={undefined} />,
    )
    expect(html).toBe('')
  })

  it('PreorderCountdownBlock draws the countdown for a future launch', () => {
    const html = renderToStaticMarkup(
      <PreorderCountdownBlock
        label="Launches in"
        style="compact"
        context={{ enabled: true, launchAt: new Date(Date.now() + 86_400_000).toISOString() }}
      />,
    )
    expect(html).toContain('Launches in')
  })

  it('DeliveryCheckerBlock draws nothing without a bound estimate action', () => {
    const html = renderToStaticMarkup(
      <DeliveryCheckerBlock context={undefined} copy={deliveryCopy} />,
    )
    expect(html).toBe('')
  })

  it('DeliveryCheckerBlock draws the PIN form when given an estimate action', () => {
    const html = renderToStaticMarkup(
      <DeliveryCheckerBlock
        context={{ estimate: async () => ({ ok: false, error: 'unused' }) }}
        copy={deliveryCopy}
      />,
    )
    expect(html).toContain('Check delivery')
  })
})

describe('a disabled app’s block renders the "off" placeholder, never the real block', () => {
  it('draws "This app is off" instead of throwing', () => {
    const built = buildAppBlocks(
      [
        {
          id: 'back-in-stock',
          name: 'Back in stock',
          blocks: [
            {
              type: 'back-in-stock/NotifyMe',
              label: 'Notify me',
              fields: {},
              defaultProps: {},
              render: () => {
                throw new Error('the real block must never run once the app is disabled')
              },
            },
          ],
        },
      ],
      new Set(), // not enabled
    )
    const Render = built.components['back-in-stock/NotifyMe']?.render
    if (!Render) throw new Error('expected a placeholder component')
    const html = renderToStaticMarkup(Render({} as never))
    expect(html).toContain('This app is off')
  })
})
