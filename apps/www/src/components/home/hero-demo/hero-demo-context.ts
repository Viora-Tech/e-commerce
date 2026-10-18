'use client'

import { createContext, type MutableRefObject, useContext } from 'react'
import type { GlobeApi } from '../../globe/globe-api'

export type DemoPhase = 'idle' | 'running' | 'done'

export type HeroDemoApi = {
  phase: DemoPhase
  /** The text the current run was started with. */
  text: string
  /** Increments on every run so the demo can restart. */
  runId: number
  /** Start (or restart) the sequence for what was typed. */
  run: (text: string) => void
  /** Jump to the finished state. */
  skip: () => void
  finish: () => void
  /** Reduced motion: the demo is shown assembled, with no sequence. */
  reducedMotion: boolean
  sectionRef: MutableRefObject<HTMLElement | null>
  globeApiRef: MutableRefObject<GlobeApi | null>
  /** Skip requests bump this; the running timeline listens. */
  skipId: number
}

export const HeroDemoContext = createContext<HeroDemoApi | null>(null)

export function useHeroDemo(): HeroDemoApi {
  const api = useContext(HeroDemoContext)
  if (!api) throw new Error('useHeroDemo must be used inside HeroStage')
  return api
}
