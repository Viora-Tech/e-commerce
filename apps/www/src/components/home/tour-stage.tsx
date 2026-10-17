'use client'

import { CircleCheck } from '@commerce/ui/icons'
import { useEffect, useRef, useState } from 'react'
import type { TourItem } from '@/data/home'
import { isCoarsePointer, loadGsap, prefersReducedMotion } from '@/lib/gsap'
import TourScreen from './tour-screen'

type TourStageProps = { item: TourItem }

const CHIP_CLASS =
  'glass-panel animate-float absolute flex items-center gap-3 rounded-full py-1.5 pr-5 pl-1.5 text-sm font-medium text-foreground'

/** Wait for React to commit the previous layer before animating it. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/**
 * The showcase window. When the feature changes the old screen slides back and blurs away, the
 * new one rises in with depth, and the two live chips fly in on curved paths (x and y use
 * different eases). The whole stage tilts toward the cursor. All of it is transform, opacity and
 * filter; reduced motion swaps instantly.
 */
export default function TourStage({ item }: TourStageProps) {
  // Hooks
  const stageRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)
  const previousRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const lastItem = useRef(item)
  const [previous, setPrevious] = useState<TourItem | null>(null)

  useEffect(() => {
    const old = lastItem.current
    if (old.key === item.key) return
    lastItem.current = item
    if (prefersReducedMotion()) return
    setPrevious(old)
    let cancelled = false
    let timeline: { kill: () => void } | null = null
    loadGsap().then(async ({ gsap }) => {
      await nextPaint()
      if (cancelled) return
      const chips = chipsRef.current?.querySelectorAll<HTMLElement>('[data-chip]') ?? []
      const done = gsap.timeline({ onComplete: () => setPrevious(null) })
      timeline = done
      if (previousRef.current) {
        done.to(
          previousRef.current,
          {
            scale: 0.96,
            y: -12,
            rotationX: 3,
            filter: 'blur(8px)',
            opacity: 0,
            duration: 0.6,
            ease: 'power3.in',
            transformOrigin: '50% 100%',
          },
          0,
        )
      }
      if (currentRef.current) {
        done.fromTo(
          currentRef.current,
          { y: 16, scale: 0.97, opacity: 0, filter: 'blur(6px)' },
          { y: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power4.out' },
          0.12,
        )
      }
      chips.forEach((chip, index) => {
        const at = 0.3 + index * 0.1
        const side = index % 2 === 0 ? -1 : 1
        done.fromTo(
          chip,
          { x: side * 90, opacity: 0, scale: 0.85 },
          { x: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out' },
          at,
        )
        done.fromTo(chip, { y: 48 }, { y: 0, duration: 0.9, ease: 'power3.out' }, at)
      })
    })
    return () => {
      cancelled = true
      timeline?.kill()
    }
  }, [item])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || isCoarsePointer() || prefersReducedMotion()) return
    let cancelled = false
    let cleanup = () => {}
    loadGsap().then(({ gsap }) => {
      if (cancelled) return
      gsap.set(stage, { transformPerspective: 1200 })
      const rotateX = gsap.quickTo(stage, 'rotationX', {
        duration: 1.1,
        ease: 'elastic.out(1, 0.8)',
      })
      const rotateY = gsap.quickTo(stage, 'rotationY', {
        duration: 1.1,
        ease: 'elastic.out(1, 0.8)',
      })
      const move = (event: PointerEvent) => {
        const box = stage.getBoundingClientRect()
        const px = (event.clientX - box.left) / box.width - 0.5
        const py = (event.clientY - box.top) / box.height - 0.5
        rotateX(-py * 3.5)
        rotateY(px * 4.5)
      }
      const leave = () => {
        rotateX(0)
        rotateY(0)
      }
      stage.addEventListener('pointermove', move)
      stage.addEventListener('pointerleave', leave)
      cleanup = () => {
        stage.removeEventListener('pointermove', move)
        stage.removeEventListener('pointerleave', leave)
        gsap.set(stage, { clearProps: 'rotationX,rotationY,transformPerspective' })
      }
    })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  return (
    <div
      id="tour-panel"
      role="tabpanel"
      aria-labelledby={`tour-tab-${item.key}`}
      className="relative mx-auto w-full max-w-190"
    >
      <div ref={stageRef} className="relative">
        <div ref={currentRef} className="relative">
          <TourScreen item={item} />
        </div>
        {previous ? (
          <div ref={previousRef} aria-hidden className="pointer-events-none absolute inset-0">
            <TourScreen item={previous} />
          </div>
        ) : null}
      </div>
      <div ref={chipsRef}>
        <span data-chip className={`${CHIP_CLASS} top-1/4 -left-2 max-sm:left-0 sm:-left-6`}>
          <span className="grid size-8 place-items-center rounded-full bg-muted">
            <CircleCheck aria-hidden className="size-4" />
          </span>
          {item.chips[0]}
        </span>
        <span data-chip className={`${CHIP_CLASS} right-0 bottom-[12%] max-sm:hidden`}>
          <span className="grid size-8 place-items-center rounded-full bg-muted">
            <CircleCheck aria-hidden className="size-4" />
          </span>
          {item.chips[1]}
        </span>
      </div>
    </div>
  )
}
