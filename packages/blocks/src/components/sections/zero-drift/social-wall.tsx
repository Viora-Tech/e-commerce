'use client'

// Port of sections/social-wall.liquid (+ assets/social-wall.js): a curated wall of Instagram / X / YouTube posts with platform tabs, a carousel or marquee layout and play-in-place YouTube tiles.
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { socialWallContent as copy } from '../../../data/zero-drift/social-wall'
import { safeHref } from '../../../slot-types'
import Icon from '../../icon'
import SocialWallTile from './social-wall-tile'
import type { Platform, SocialPost } from './social-wall-types'

type SocialWallProps = {
  heading: string
  subheading: string
  layout: 'grid' | 'carousel'
  autoscroll: boolean
  scrollSeconds: number
  showTabs: boolean
  instagramUrl: string
  xUrl: string
  youtubeUrl: string
  posts: SocialPost[]
}

type Tab = Platform | 'all'

// Tabs render in this fixed order, so reordering posts never reshuffles the tab row.
const PLATFORM_ORDER: Platform[] = ['instagram', 'x', 'youtube']
const TAB_LABEL: Record<Tab, string> = {
  all: copy.tabAll,
  instagram: copy.tabInstagram,
  x: copy.tabX,
  youtube: copy.tabYoutube,
}
const EDGE_SLACK = 4

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey
}

/** The tab index a key press moves to (WAI-ARIA tabs: arrows wrap, Home/End jump), or -1. */
function nextTabIndex(key: string, current: number, count: number) {
  if (key === 'ArrowRight') return (current + 1) % count
  if (key === 'ArrowLeft') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return -1
}

export default function SocialWall({
  heading,
  subheading,
  layout,
  autoscroll,
  scrollSeconds,
  showTabs,
  instagramUrl,
  xUrl,
  youtubeUrl,
  posts,
}: SocialWallProps) {
  // Hooks
  const baseId = useId()
  const [selected, setSelected] = useState<Tab>('all')
  const [playing, setPlaying] = useState<string | null>(null)
  const [edges, setEdges] = useState({ start: true, end: false })
  const track = useRef<HTMLUListElement>(null)
  const tablist = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = track.current
    if (!el || layout !== 'carousel') return
    const update = () =>
      setEdges({
        start: el.scrollLeft <= EDGE_SLACK,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_SLACK,
      })
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [layout])

  // Helpers
  const tabId = (tab: Tab) => `${baseId}-tab-${tab}`
  const selectTab = (tab: Tab, focusIndex?: number) => {
    setSelected(tab)
    // A player inside a tile that is about to be hidden would keep talking to an empty room.
    setPlaying(null)
    if (focusIndex === undefined) return
    tablist.current?.querySelectorAll<HTMLElement>('[role="tab"]')[focusIndex]?.focus()
  }

  // Event handlers
  const handleStep = (direction: 1 | -1) => {
    const el = track.current
    if (!el) return
    const tile = el.querySelector('.social-tile')
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0
    const step = (tile ? tile.getBoundingClientRect().width : 0) + gap
    el.scrollBy({ left: direction * step * 2, behavior: 'smooth' })
  }
  const handleTabKey = (event: KeyboardEvent<HTMLDivElement>, order: Tab[]) => {
    const tabs = Array.from(tablist.current?.querySelectorAll('[role="tab"]') ?? [])
    const current = tabs.indexOf(document.activeElement as Element)
    if (current === -1) return
    const next = nextTabIndex(event.key, current, order.length)
    if (next === -1) return
    event.preventDefault()
    selectTab(order[next] ?? 'all', next)
  }
  const handlePlay = (key: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    // Modifier and middle clicks open the video in a new tab as usual.
    if (!isPlainClick(event)) return
    event.preventDefault()
    setPlaying(key)
  }

  // Early returns
  if (!posts?.length) return <p className="social-wall__empty page-width">{copy.empty}</p>

  // Render logic
  const carousel = layout === 'carousel'
  const marquee = carousel && autoscroll
  const present = PLATFORM_ORDER.filter((p) => posts.some((post) => post.platform === p))
  const tabsShown = showTabs && present.length > 1
  const order: Tab[] = ['all', ...present]
  const active = order.includes(selected) ? selected : 'all'
  const panelId = `${baseId}-panel`
  const runs = marquee ? [0, 1] : [0]
  const follow = [
    { url: safeHref(instagramUrl), label: copy.followInstagram, icon: 'instagram' as const },
    { url: safeHref(xUrl), label: copy.followX, icon: 'twitter' as const },
    { url: safeHref(youtubeUrl), label: copy.followYoutube, icon: 'youtube' as const },
  ].filter((f) => f.url)
  const gridClass = `social-wall__grid${carousel ? ' social-wall__grid--carousel' : ''}${marquee ? ' social-wall__grid--marquee' : ''}`
  const gridStyle = marquee
    ? ({ '--marquee-duration': `${scrollSeconds}s` } as CSSProperties)
    : undefined
  const panelAria = tabsShown
    ? { role: 'tabpanel', 'aria-labelledby': tabId(active), tabIndex: 0 }
    : {}

  return (
    <div className="section-social-wall page-width">
      <div className="social-wall__head">
        <div className="social-wall__intro">
          {heading ? <h2 className="social-wall__heading h2">{heading}</h2> : null}
          {subheading ? <p className="social-wall__subheading">{subheading}</p> : null}
        </div>
        {follow.length ? (
          <ul className="social-wall__follow">
            {follow.map((f) => (
              <li key={f.label}>
                <a
                  href={f.url ?? '#'}
                  className="social-wall__follow-link"
                  target="_blank"
                  rel="noopener"
                >
                  <Icon name={f.icon} size={18} />
                  <span className="visually-hidden">{f.label}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="social-wall__tab-group">
        {tabsShown ? (
          <div className="social-wall__tabs">
            <div
              ref={tablist}
              className="social-wall__tablist"
              role="tablist"
              aria-label={copy.tablistLabel}
              tabIndex={-1}
              onKeyDown={(e) => handleTabKey(e, order)}
            >
              {order.map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  className="social-wall__tab"
                  role="tab"
                  id={tabId(tab)}
                  aria-controls={panelId}
                  aria-selected={active === tab}
                  tabIndex={active === tab ? 0 : -1}
                  data-platform={tab}
                  onClick={() => selectTab(tab, i)}
                >
                  <span className="social-wall__tab-label">{TAB_LABEL[tab]}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="social-wall__panel" id={panelId} {...panelAria}>
          {carousel && !autoscroll ? (
            <div className="social-wall__arrows">
              <button
                type="button"
                className="social-wall__arrow"
                data-carousel-prev
                aria-label={copy.previous}
                disabled={edges.start}
                onClick={() => handleStep(-1)}
              >
                <Icon name="arrow" size={16} />
              </button>
              <button
                type="button"
                className="social-wall__arrow"
                data-carousel-next
                aria-label={copy.next}
                disabled={edges.end}
                onClick={() => handleStep(1)}
              >
                <Icon name="arrow" size={16} />
              </button>
            </div>
          ) : null}
          <ul ref={track} className={gridClass} style={gridStyle}>
            {runs.map((run) =>
              posts.map((post, i) => {
                const key = `${run}-${i}`
                return (
                  <SocialWallTile
                    key={key}
                    post={post}
                    hidden={active !== 'all' && post.platform !== active}
                    duplicate={run > 0}
                    playing={playing === key}
                    onPlay={handlePlay(key)}
                  />
                )
              }),
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
