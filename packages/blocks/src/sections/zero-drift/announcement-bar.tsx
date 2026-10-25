import type { ComponentConfig, Fields } from '@puckeditor/core'
import SectionCustomCss from '../../components/section-custom-css'
import AnnouncementBar from '../../components/sections/announcement-bar'
import { announcementBarContent as copy } from '../../data/zero-drift/announcement-bar'
import {
  bleedFrameProps,
  defaultSectionSettings,
  migrateSectionSettings,
  type SectionSettingsValue,
  sectionSettingsField,
} from '../../section-settings'
import { SCHEMES } from '../framed'
import { inlineRichtext } from '../inline-fields'

/**
 * Saved before the Zero Drift port: one plain-text message and a labelled link. Still read, as a
 * single announcement, until the editor's `resolveData` rewrites it into `announcements`.
 */
type LegacyAnnouncement = { text?: unknown; link?: { label?: unknown; href?: unknown } }

export type AnnouncementBarProps = LegacyAnnouncement & {
  announcements: { text: string; link: string }[]
  scheme: string
  displayMode: 'rotate' | 'marquee'
  autorotate: boolean
  autorotateSpeed: number
  marqueeSpeed: number
  showSocial: boolean
  socials: { platform: string; url: string }[]
  /** Spacing, visibility and anchor (`bleed` section settings), on a frame around the bar. */
  settings: SectionSettingsValue
}

const f = copy.fields

const onOff = (label: string) => ({ type: 'radio', label, options: copy.onOff }) as const

/** The bar was never framed, so its settings start with no padding: it looks as it did. */
const BAR_SETTINGS = defaultSectionSettings({ padTop: 0, padBottom: 0 })

const defaults: AnnouncementBarProps = {
  settings: BAR_SETTINGS,
  announcements: copy.announcements.map((a) => ({ ...a })),
  scheme: copy.scheme,
  displayMode: copy.displayMode,
  autorotate: copy.autorotate,
  autorotateSpeed: copy.autorotateSpeed,
  marqueeSpeed: copy.marqueeSpeed,
  showSocial: copy.showSocial,
  socials: [],
}

/** The old single message as an announcement, or null when the props are already new-style. */
function legacyAnnouncement(p: LegacyAnnouncement): { text: string; link: string } | null {
  if (typeof p.text !== 'string' || p.text.trim() === '') return null
  const href = typeof p.link?.href === 'string' ? p.link.href : ''
  return { text: p.text, link: href }
}

/**
 * Zero Drift's announcement bar (`sections/announcement-bar.liquid`). Keeps the `AnnouncementBar`
 * key and its old `{ text, link, scheme }` props, so bars saved before the port still render.
 */
export function announcementBarSection(): ComponentConfig {
  const config: ComponentConfig<AnnouncementBarProps> = {
    label: copy.label,
    fields: {
      announcements: {
        type: 'array',
        label: f.announcements,
        getItemSummary: (a) => (typeof a.link === 'string' && a.link) || f.fallback,
        defaultItemProps: { ...copy.newAnnouncement },
        arrayFields: {
          text: inlineRichtext(f.text),
          link: { type: 'text', label: f.link },
        },
      },
      displayMode: { type: 'select', label: f.displayMode, options: [...copy.displayModes] },
      autorotate: onOff(f.autorotate),
      autorotateSpeed: { type: 'number', label: f.autorotateSpeed, min: 3, max: 8 },
      marqueeSpeed: { type: 'number', label: f.marqueeSpeed, min: 20, max: 60, step: 5 },
      showSocial: onOff(f.showSocial),
      socials: {
        type: 'array',
        label: f.socials,
        max: 4,
        getItemSummary: (s) => (typeof s.platform === 'string' && s.platform) || f.socialFallback,
        defaultItemProps: { platform: 'instagram', url: '' },
        arrayFields: {
          platform: { type: 'select', label: f.platform, options: [...copy.socialOptions] },
          url: { type: 'text', label: f.url },
        },
      },
      scheme: { type: 'select', label: f.scheme, options: SCHEMES },
      settings: sectionSettingsField(SCHEMES, 'bleed'),
    } as Fields<AnnouncementBarProps>,
    defaultProps: defaults,
    // Rewrites a pre-port bar into the new shape the first time the editor loads it: its one
    // message stays still (rotate mode with nothing to rotate), as it always looked.
    resolveData: async ({ props }) => {
      const legacy = legacyAnnouncement(props)
      return legacy
        ? { props: { text: '', announcements: [legacy], displayMode: 'rotate' as const } }
        : { props }
    },
    render: (p) => {
      const legacy = legacyAnnouncement(p)
      // The bar's own `scheme` is its colour; only spacing, visibility and anchor come from here.
      const settings = migrateSectionSettings({ settings: p.settings }, BAR_SETTINGS)
      const frame = bleedFrameProps(settings)
      return (
        <div {...frame} className={`section-frame${frame.className ? ` ${frame.className}` : ''}`}>
          <SectionCustomCss css={settings.advanced.customCss} />
          <AnnouncementBar
            announcements={legacy ? [legacy] : (p.announcements ?? [])}
            displayMode={legacy || p.displayMode === 'rotate' ? 'rotate' : 'marquee'}
            autorotate={p.autorotate !== false}
            autorotateSpeed={Number(p.autorotateSpeed) || copy.autorotateSpeed}
            marqueeSpeed={Number(p.marqueeSpeed) || copy.marqueeSpeed}
            socials={p.showSocial === false ? [] : (p.socials ?? [])}
            scheme={p.scheme}
          />
        </div>
      )
    },
  }
  return config as unknown as ComponentConfig
}
