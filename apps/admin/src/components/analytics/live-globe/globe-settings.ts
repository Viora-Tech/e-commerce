/**
 * The Live view globe's "Globe settings" panel: what a merchant can change about how their own
 * globe looks and moves, saved per browser (localStorage, not the store's settings — every
 * person who opens the page keeps their own). Reading or writing storage never throws: a
 * private window, cleared storage or a full quota all just fall back to the defaults below.
 */

export type GlobeLayerSettings = {
  borders: boolean
  coastlines: boolean
  grid: boolean
  arcs: boolean
  glow: boolean
}

export type GlobeMotionSpeed = 'slow' | 'normal' | 'fast'
export type GlobeStartView = 'india' | 'mine' | 'world'

export type GlobeMotionSettings = {
  autoRotate: boolean
  speed: GlobeMotionSpeed
  startView: GlobeStartView
  rememberZoom: boolean
}

export type GlobeStyle = 'solid' | 'dotted'
export type GlobeThemePreset = 'accent' | 'night' | 'ocean' | 'mono'
/** How fine the dotted land is: more, smaller dots (`fine`, the Home card's look) or fewer,
 * bigger ones. */
export type GlobeDotSize = 'fine' | 'medium' | 'bold'

export type GlobeLookSettings = {
  /** Land: filled continents, or dots (drawn in the shader; `webgl/dot-layout.ts`). */
  style: GlobeStyle
  /** Country borders (part of the "Country borders" layer, when that is on): the shader's
   * line, or small dots along it (`webgl/border-points.ts`, `webgl/border-dot-stride.ts`).
   * Coastlines are always the solid line either way. */
  borderStyle: GlobeStyle
  dotSize: GlobeDotSize
  theme: GlobeThemePreset
  /** Hex colours (e.g. "#1c2b4a"), or null to use the theme preset's own. */
  customLand: string | null
  customOcean: string | null
  customAccent: string | null
}

export type GlobeTimeRange = '1h' | '24h' | '7d'

export type GlobeDataSettings = {
  timeRange: GlobeTimeRange
  /** Marker size scales with order value, and the top 10% get a soft glow. */
  highlightBigOrders: boolean
  /** A soft terminator line between day and night, from the current time. */
  dayNightShadow: boolean
}

export type GlobeSettings = {
  layers: GlobeLayerSettings
  motion: GlobeMotionSettings
  look: GlobeLookSettings
  data: GlobeDataSettings
  /** Only read back when `motion.rememberZoom` is on. */
  lastZoom: number
}

/* v2 (22 Oct 2026): the defaults changed to the Home card's look, so older saved choices reset. */
const STORAGE_KEY = 'wc-live-globe-settings-v2'

const MOTION_SPEEDS: readonly GlobeMotionSpeed[] = ['slow', 'normal', 'fast']
const START_VIEWS: readonly GlobeStartView[] = ['india', 'mine', 'world']
const STYLES: readonly GlobeStyle[] = ['solid', 'dotted']
const DOT_SIZES: readonly GlobeDotSize[] = ['fine', 'medium', 'bold']
const THEMES: readonly GlobeThemePreset[] = ['accent', 'night', 'ocean', 'mono']
const TIME_RANGES: readonly GlobeTimeRange[] = ['1h', '24h', '7d']

/** Reduced-motion visitors get auto-rotate off by default; everything else is the same for
 * everyone until they change it. */
export function defaultGlobeSettings(prefersReducedMotion: boolean): GlobeSettings {
  return {
    /* The Home card's look by default: no lines on the globe, just dots, glow and arcs. */
    layers: { borders: false, coastlines: false, grid: false, arcs: true, glow: true },
    motion: {
      autoRotate: !prefersReducedMotion,
      speed: 'normal',
      startView: 'india',
      rememberZoom: false,
    },
    look: {
      /* Dotted land by default, like the Home card's globe (owner 2026-10-22). */
      style: 'dotted',
      borderStyle: 'solid',
      dotSize: 'fine',
      theme: 'accent',
      customLand: null,
      customOcean: null,
      customAccent: null,
    },
    data: { timeRange: '24h', highlightBigOrders: true, dayNightShadow: false },
    lastZoom: 1,
  }
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

const HEX_COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/

function hexOrNull(value: unknown): string | null {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : null
}

/** Merges parsed storage onto the defaults field by field, so an older/partial save (or a
 * future field this build does not know yet) never wipes out the rest. */
function sanitize(raw: unknown, fallback: GlobeSettings): GlobeSettings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const layersRaw = (r.layers && typeof r.layers === 'object' ? r.layers : {}) as Record<
    string,
    unknown
  >
  const motionRaw = (r.motion && typeof r.motion === 'object' ? r.motion : {}) as Record<
    string,
    unknown
  >
  const lookRaw = (r.look && typeof r.look === 'object' ? r.look : {}) as Record<string, unknown>
  const dataRaw = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, unknown>

  return {
    layers: {
      borders: bool(layersRaw.borders, fallback.layers.borders),
      coastlines: bool(layersRaw.coastlines, fallback.layers.coastlines),
      grid: bool(layersRaw.grid, fallback.layers.grid),
      arcs: bool(layersRaw.arcs, fallback.layers.arcs),
      glow: bool(layersRaw.glow, fallback.layers.glow),
    },
    motion: {
      autoRotate: bool(motionRaw.autoRotate, fallback.motion.autoRotate),
      speed: oneOf(motionRaw.speed, MOTION_SPEEDS, fallback.motion.speed),
      startView: oneOf(motionRaw.startView, START_VIEWS, fallback.motion.startView),
      rememberZoom: bool(motionRaw.rememberZoom, fallback.motion.rememberZoom),
    },
    look: {
      style: oneOf(lookRaw.style, STYLES, fallback.look.style),
      borderStyle: oneOf(lookRaw.borderStyle, STYLES, fallback.look.borderStyle),
      dotSize: oneOf(lookRaw.dotSize, DOT_SIZES, fallback.look.dotSize),
      theme: oneOf(lookRaw.theme, THEMES, fallback.look.theme),
      customLand: hexOrNull(lookRaw.customLand),
      customOcean: hexOrNull(lookRaw.customOcean),
      customAccent: hexOrNull(lookRaw.customAccent),
    },
    data: {
      timeRange: oneOf(dataRaw.timeRange, TIME_RANGES, fallback.data.timeRange),
      highlightBigOrders: bool(dataRaw.highlightBigOrders, fallback.data.highlightBigOrders),
      dayNightShadow: bool(dataRaw.dayNightShadow, fallback.data.dayNightShadow),
    },
    lastZoom:
      typeof r.lastZoom === 'number' && Number.isFinite(r.lastZoom)
        ? r.lastZoom
        : fallback.lastZoom,
  }
}

/** Reads saved settings, falling back to the defaults (per field) when storage is empty,
 * unreadable, or holds something unexpected. Never throws. */
export function loadGlobeSettings(prefersReducedMotion: boolean): GlobeSettings {
  const fallback = defaultGlobeSettings(prefersReducedMotion)
  try {
    if (typeof window === 'undefined') return fallback
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    return sanitize(JSON.parse(raw), fallback)
  } catch {
    return fallback
  }
}

/** Saves the whole settings object. Best-effort: a private window or a full quota just means
 * the choice does not survive this tab. The zoom already saved (by `saveLastZoom`, which never
 * goes through React state, so `settings.lastZoom` is stale) is kept unless `replaceZoom`. */
export function saveGlobeSettings(
  settings: GlobeSettings,
  options: { replaceZoom?: boolean } = {},
): void {
  try {
    if (typeof window === 'undefined') return
    const raw = options.replaceZoom ? null : window.localStorage.getItem(STORAGE_KEY)
    const stored = raw ? JSON.parse(raw) : null
    const lastZoom =
      stored && typeof stored.lastZoom === 'number' && Number.isFinite(stored.lastZoom)
        ? stored.lastZoom
        : settings.lastZoom
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, lastZoom }))
  } catch {
    // Storage unavailable; the setting still applies for this session, just not saved.
  }
}

/** Persists only the remembered zoom level, without disturbing the rest of a saved settings
 * object (or creating one, when nothing has been saved yet). Called every second or so while
 * zooming, so it never goes through React state. */
export function saveLastZoom(zoom: number): void {
  try {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const base = parsed && typeof parsed === 'object' ? parsed : {}
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, lastZoom: zoom }))
  } catch {
    // Storage unavailable; the zoom just resets next visit.
  }
}
