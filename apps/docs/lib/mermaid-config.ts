/**
 * The one place diagram styling lives. Every ```mermaid block in content/ renders through
 * components/mermaid.tsx (aliased over @theguild/remark-mermaid's component in
 * next.config.mjs), which calls `mermaidConfig(isDark)` below.
 *
 * Look: Mermaid's hand-drawn style (`look: 'handDrawn'`, rough.js strokes), supported by
 * Mermaid 11+ for flowcharts, state and ER diagrams; sequence diagrams keep the classic
 * look. Colours mirror the tokens in app/globals.css: Ocean Green accent (#4ea674 light,
 * #30d158 dark) on neutral greys, readable on both page backgrounds.
 */
import type { MermaidConfig } from 'mermaid'

type Palette = {
  text: string
  muted: string
  line: string
  nodeFill: string
  nodeBorder: string
  accent: string
  accentFill: string
  groupFill: string
  groupBorder: string
  noteFill: string
  noteBorder: string
  pageBg: string
}

const light: Palette = {
  text: '#171717',
  muted: '#666666',
  line: '#8f8f8f',
  nodeFill: '#ffffff',
  nodeBorder: '#4ea674',
  accent: '#3a845c',
  accentFill: '#eef7f1',
  groupFill: '#fafafa',
  groupBorder: '#d6d6d6',
  noteFill: '#fffbeb',
  noteBorder: '#fcd34d',
  pageBg: '#ffffff',
}

const dark: Palette = {
  text: '#ededed',
  muted: '#a1a1a1',
  line: '#737373',
  nodeFill: '#1a1a1a',
  nodeBorder: '#30d158',
  accent: '#30d158',
  accentFill: '#14261a',
  groupFill: '#141414',
  groupBorder: '#383838',
  noteFill: '#2a2310',
  noteBorder: '#a16207',
  pageBg: '#111111',
}

/** Stable strokes, so a diagram doesn't wobble differently on every render or theme switch. */
const HAND_DRAWN_SEED = 7

export function mermaidConfig(isDark: boolean, fontFamily: string): MermaidConfig {
  const p = isDark ? dark : light
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    look: 'handDrawn',
    handDrawnSeed: HAND_DRAWN_SEED,
    theme: 'base',
    fontFamily,
    themeCSS: 'margin: 0 auto;',
    flowchart: { curve: 'basis', padding: 12, htmlLabels: true },
    sequence: { mirrorActors: false, showSequenceNumbers: true, actorMargin: 40 },
    er: { layoutDirection: 'TB' },
    themeVariables: {
      darkMode: isDark,
      background: p.pageBg,
      fontSize: '15px',
      fontFamily,
      primaryColor: p.nodeFill,
      primaryTextColor: p.text,
      primaryBorderColor: p.nodeBorder,
      secondaryColor: p.accentFill,
      secondaryTextColor: p.text,
      secondaryBorderColor: p.nodeBorder,
      tertiaryColor: p.groupFill,
      tertiaryTextColor: p.text,
      tertiaryBorderColor: p.groupBorder,
      mainBkg: p.nodeFill,
      nodeBorder: p.nodeBorder,
      nodeTextColor: p.text,
      textColor: p.text,
      titleColor: p.text,
      lineColor: p.line,
      clusterBkg: p.groupFill,
      clusterBorder: p.groupBorder,
      edgeLabelBackground: p.pageBg,
      noteBkgColor: p.noteFill,
      noteBorderColor: p.noteBorder,
      noteTextColor: p.text,
      // Sequence diagrams
      actorBkg: p.accentFill,
      actorBorder: p.nodeBorder,
      actorTextColor: p.text,
      actorLineColor: p.groupBorder,
      signalColor: p.muted,
      signalTextColor: p.text,
      labelBoxBkgColor: p.accentFill,
      labelBoxBorderColor: p.nodeBorder,
      labelTextColor: p.text,
      loopTextColor: p.muted,
      activationBkgColor: p.accentFill,
      activationBorderColor: p.nodeBorder,
      sequenceNumberColor: p.pageBg,
      // State diagrams
      stateBkg: p.nodeFill,
      stateLabelColor: p.text,
      compositeBackground: p.groupFill,
      compositeTitleBackground: p.groupFill,
      altBackground: p.groupFill,
      transitionColor: p.line,
      transitionLabelColor: p.muted,
      specialStateColor: p.accent,
      innerEndBackground: p.accent,
      // ER diagrams
      attributeBackgroundColorOdd: p.nodeFill,
      attributeBackgroundColorEven: p.groupFill,
    },
  }
}
