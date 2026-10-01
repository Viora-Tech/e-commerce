import { useRef } from 'react'
import { remToPx } from './data/motion'

/** How far the pill reaches past its item's text on each side (the theme's 14px). */
const PILL_PAD_REM = 0.875

/**
 * The desktop menu's hover indicator (Glide `assets/nav-decoration.js`): one element, a
 * glowing underline or a soft pill, that slides and stretches to the item under the pointer
 * or keyboard focus. It is moved with transform and width straight on the element, so the row
 * never reflows and React never re-renders for it. Appears in place on first show rather than
 * sliding in from the left edge.
 */
export function useNavIndicator(look: 'underline' | 'pill') {
  const indicatorRef = useRef<HTMLLIElement>(null)

  const moveTo = (item: Element | null | undefined) => {
    const indicator = indicatorRef.current
    const list = indicator?.parentElement
    const link = item?.querySelector('.header__menu-link')
    if (!indicator || !list || !link) return
    const pad = look === 'pill' ? remToPx(PILL_PAD_REM) : 0
    const lb = list.getBoundingClientRect()
    const ib = link.getBoundingClientRect()
    indicator.style.width = `${ib.width + pad * 2}px`
    indicator.style.transform = `translateX(${ib.left - lb.left - pad}px)`
    if (!indicator.classList.contains('is-on')) {
      indicator.classList.add('is-snap')
      void indicator.offsetWidth
      indicator.classList.remove('is-snap')
    }
    indicator.classList.add('is-on')
  }

  const hide = () => indicatorRef.current?.classList.remove('is-on')

  return { indicatorRef, moveTo, hide }
}
