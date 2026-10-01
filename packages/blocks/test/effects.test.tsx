import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AnimatedTooltip from '../src/effects/animated-tooltip'
import Card3dContainer from '../src/effects/card-3d-container'
import FocusCards from '../src/effects/focus-cards'
import Lens from '../src/effects/lens'
import Marquee from '../src/effects/marquee'
import Marquee3d from '../src/effects/marquee-3d'
import Meteors from '../src/effects/meteors'
import Safari from '../src/effects/safari'

// Server markup of the shared UI-kit effects (Magic UI, Aceternity UI). In the browser they
// add motion on top; the server render must already show the content, once, accessibly.
describe('UI-kit effects', () => {
  it('Marquee repeats its content, hiding and disabling every copy after the first', () => {
    const html = renderToStaticMarkup(
      <Marquee repeat={3} durationSeconds={12} gapRem={2}>
        <a href="/x">Card</a>
      </Marquee>,
    )
    expect(html.match(/Card/g)).toHaveLength(3)
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2)
    expect(html).toContain('--duration:12s')
    expect(html).toContain('--gap:2rem')
    expect(html).toContain('animate-[marquee_var(--duration)_linear_infinite]')
  })

  it('Marquee runs vertically and in reverse when asked', () => {
    const html = renderToStaticMarkup(
      <Marquee vertical reverse pauseOnHover>
        x
      </Marquee>,
    )
    expect(html).toContain('animate-[marquee-vertical_var(--duration)_linear_infinite]')
    expect(html).toContain('[animation-direction:reverse]')
    expect(html).toContain('group-hover:[animation-play-state:paused]')
  })

  it('Marquee3d lays its columns on one labelled, tilted plane', () => {
    const html = renderToStaticMarkup(
      <Marquee3d label="Reviews" columns={['a', 'b', 'c', 'd']} durationSeconds={30} />,
    )
    expect(html).toContain('aria-label="Reviews"')
    expect(html).toContain('rotateX(18deg)')
    expect(html.match(/animate-\[marquee-vertical/g)?.length).toBe(8)
  })

  it('Meteors draws the same meteors on every render (no hydration mismatch)', () => {
    const a = renderToStaticMarkup(<Meteors count={5} />)
    const b = renderToStaticMarkup(<Meteors count={5} />)
    expect(a).toBe(b)
    expect(a.match(/meteor-effect/g)).toHaveLength(5)
    expect(a).toContain('aria-hidden="true"')
    expect(a).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })

  it('Safari puts its children on the screen under a frame that ignores the pointer', () => {
    const html = renderToStaticMarkup(
      <Safari url="waimers.in">
        <p>Screen</p>
      </Safari>,
    )
    expect(html).toContain('<p>Screen</p>')
    expect(html).toContain('waimers.in')
    expect(html).toContain('pointer-events-none')
    expect(html).toContain('fill-[var(--color-line)]')
  })

  it('AnimatedTooltip shows initials without a photo and keeps the card text in the page', () => {
    const html = renderToStaticMarkup(
      <AnimatedTooltip
        items={[{ id: '1', name: 'Asha', designation: '5 stars', initials: 'A', hue: 120 }]}
        more="+9"
      />,
    )
    expect(html).toContain('Asha')
    expect(html).toContain('5 stars')
    expect(html).toContain('--hue:120')
    expect(html).toContain('+9')
    expect(html).toContain('tabindex="0"')
  })

  it('Lens, FocusCards and Card3dContainer render their children once at rest', () => {
    const lens = renderToStaticMarkup(
      <Lens>
        <img src="/a.jpg" alt="Pad" />
      </Lens>,
    )
    expect(lens.match(/<img/g)).toHaveLength(1)
    const cards = renderToStaticMarkup(
      <FocusCards className="grid">
        <a href="/1">One</a>
        <a href="/2">Two</a>
      </FocusCards>,
    )
    expect(cards).toContain('One')
    expect(cards).toContain('[&amp;&gt;[data-focus-dim]]:blur-sm')
    const card = renderToStaticMarkup(
      <Card3dContainer containerClassName="wrap" className="panel">
        Body
      </Card3dContainer>,
    )
    expect(card).toContain('[perspective:62.5rem]')
    expect(card).toContain('Body')
  })
})
