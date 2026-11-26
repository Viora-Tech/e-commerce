'use client'

import { type ReactNode, useEffect, useRef } from 'react'

type AppShellActionsProps = { children: ReactNode }

/** Desktop only: on phones the actions sit in their own row above the page. */
const DESKTOP = '(min-width: 48rem)'
/** A heading this close to the top of the page is the row the actions float beside. */
const TOP_SLACK_PX = 16
const ROOM = 'data-app-actions-room'

/**
 * Makes room for the floating actions beside the page's first heading only: the page header
 * (or a page's first section heading) gets right padding as wide as the actions, so tables and
 * cards below keep the page's full width (owner, 26 Nov 2026). A page whose first heading is not
 * at the top starts below the actions instead. Re-applied as the page's content changes
 * (loading, another app page).
 */
function makeRoom(host: HTMLElement, actions: HTMLElement) {
  for (const n of host.querySelectorAll<HTMLElement>(`[${ROOM}]`)) {
    n.style.paddingRight = ''
    n.removeAttribute(ROOM)
  }
  host.style.paddingTop = ''
  if (!window.matchMedia(DESKTOP).matches) return
  const head = [
    ...host.querySelectorAll<HTMLElement>('[data-page-header],[data-section-head]'),
  ].find((h) => !actions.contains(h))
  const top = host.getBoundingClientRect().top
  if (head && head.getBoundingClientRect().top - top < TOP_SLACK_PX) {
    head.style.paddingRight = `${actions.offsetWidth / 16 + 1}rem`
    head.setAttribute(ROOM, '')
  } else {
    host.style.paddingTop = `${actions.offsetHeight / 16 + 1}rem`
  }
}

/**
 * An app page's status pill, primary action and "…" menu, top right of the page (absolute on
 * desktop), with room made for them beside the first heading (`makeRoom`).
 */
export default function AppShellActions({ children }: AppShellActionsProps) {
  // Hooks
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const actions = ref.current
    const host = actions?.parentElement
    if (!actions || !host) return
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => makeRoom(host, actions))
    }
    schedule()
    const resize = new ResizeObserver(schedule)
    resize.observe(actions)
    resize.observe(host)
    const mutations = new MutationObserver(schedule)
    mutations.observe(host, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutations.disconnect()
    }
  }, [])

  // Render logic
  return (
    <div
      ref={ref}
      className="flex items-center justify-end gap-2 md:absolute md:top-0 md:right-0 md:z-10"
    >
      {children}
    </div>
  )
}
