import {
  Archivo,
  DM_Sans,
  Figtree,
  Fraunces,
  IBM_Plex_Sans,
  Instrument_Serif,
  Inter,
  Lexend,
  Lora,
  Manrope,
  Outfit,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Sora,
  Space_Grotesk,
  Work_Sans,
} from 'next/font/google'

/*
 * Every face a theme can choose, self-hosted by next/font. Each one defines a
 * `--font-<id>` custom property; `themeToCss` points --font-heading and
 * --font-body at the chosen two. Only Archivo and Figtree (the default Waimers
 * pairing) are preloaded: the rest declare @font-face and download only when a
 * theme actually uses them, so the curated list costs nothing it does not paint.
 * The ids here must match THEME_FONTS in @commerce/core.
 *
 * next/font only accepts literal options, hence the repetition.
 */
export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
})

export const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-figtree',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
})
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  preload: false,
})
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  preload: false,
})
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
  preload: false,
})
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  preload: false,
})
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap', preload: false })
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  preload: false,
})
const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-lexend',
  display: 'swap',
  preload: false,
})
const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
  preload: false,
})
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
  preload: false,
})
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
  display: 'swap',
  preload: false,
})
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
})
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap', preload: false })
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
  display: 'swap',
  preload: false,
})

/** Class names that define every `--font-<id>` variable, for the <html> element. */
export const themeFontVariables = [
  archivo,
  figtree,
  inter,
  manrope,
  dmSans,
  plusJakartaSans,
  spaceGrotesk,
  sora,
  outfit,
  lexend,
  workSans,
  ibmPlexSans,
  playfairDisplay,
  fraunces,
  lora,
  instrumentSerif,
]
  .map((f) => f.variable)
  .join(' ')
