'use client'

import dynamic from 'next/dynamic'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { isCoarsePointer, prefersReducedMotion } from '@/lib/gsap'
import type { GlobeApi } from '../../globe/globe-api'
import { type DemoPhase, HeroDemoContext } from './hero-demo-context'

type HeroStageProps = { children: ReactNode; className?: string }

// The sequence (GSAP, arcs, card) loads on the client only, after the hero text has painted.
const StoreBuildDemo = dynamic(() => import('./store-build-demo'), { ssr: false })

/**
 * The hero section plus the state the "build your store" sequence shares: the typed text, the run
 * counter and a handle on the globe. It also turns the pointer position into `--px` / `--py` on
 * the section, which the tilt card, the globe and the floats read for their parallax. The hero's
 * text is server-rendered children, so it never waits on any of this.
 */
export default function HeroStage({ children, className }: HeroStageProps) {
  // Hooks
  const sectionRef = useRef<HTMLElement | null>(null)
  const globeApiRef = useRef<GlobeApi | null>(null)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [text, setText] = useState('')
  const [runId, setRunId] = useState(0)
  const [skipId, setSkipId] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section || isCoarsePointer() || prefersReducedMotion()) return
    let frame = 0
    const move = (event: PointerEvent) => {
      const box = section.getBoundingClientRect()
      const px = ((event.clientX - box.left) / box.width - 0.5) * 2
      const py = ((event.clientY - box.top) / box.height - 0.5) * 2
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        section.style.setProperty('--px', px.toFixed(3))
        section.style.setProperty('--py', py.toFixed(3))
      })
    }
    const leave = () => {
      cancelAnimationFrame(frame)
      section.style.setProperty('--px', '0')
      section.style.setProperty('--py', '0')
    }
    section.addEventListener('pointermove', move)
    section.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(frame)
      section.removeEventListener('pointermove', move)
      section.removeEventListener('pointerleave', leave)
    }
  }, [])

  // Event handlers
  const run = (next: string) => {
    setText(next)
    setRunId((id) => id + 1)
    setPhase('running')
  }
  const skip = () => setSkipId((id) => id + 1)
  const finish = () => setPhase('done')

  return (
    <HeroDemoContext.Provider
      value={{
        phase,
        text,
        runId,
        run,
        skip,
        skipId,
        finish,
        reducedMotion,
        sectionRef,
        globeApiRef,
      }}
    >
      <section ref={sectionRef} data-demo={runId > 0} className={className}>
        {children}
        <StoreBuildDemo />
      </section>
    </HeroDemoContext.Provider>
  )
}
