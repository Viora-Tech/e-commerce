import NotesSeries from '../../components/sections/zero-drift/notes-series'
import { notesSeriesContent as copy } from '../../data/zero-drift/notes-series'
import { defaultSectionSettings } from '../../section-settings'
import type { CardArticle } from '../../types'
import { type Frame, framed } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

export type NotesSeriesProps = Frame & {
  eyebrow: string
  heading: string
  text: string
  blogHandle: string
  seriesLabel: string
  limit: number
  showViewAll: boolean
  /** Filled by resolveData; not edited directly. */
  resolved?: CardArticle[]
}

const defaults = {
  eyebrow: copy.eyebrow,
  heading: copy.heading,
  text: copy.text,
  blogHandle: copy.blogHandle,
  seriesLabel: copy.seriesLabel,
  limit: copy.limit,
  showViewAll: copy.showViewAll,
}

export function notesSeriesSection(loaders: ZeroDriftLoaders) {
  return framed<NotesSeriesProps>(
    copy.label,
    {
      eyebrow: inlineText('Small line above the heading'),
      heading: inlineText('Heading'),
      text: inlineRichtext('Text'),
      blogHandle: { type: 'text', label: 'Blog handle' },
      seriesLabel: { type: 'text', label: 'Series name on each card' },
      limit: { type: 'number', label: 'Notes to show', min: 2, max: 12 },
      showViewAll: {
        type: 'radio',
        label: 'Show the "All notes" button',
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
      },
    },
    defaults,
    (p) => (
      <NotesSeries
        eyebrow={p.eyebrow}
        heading={p.heading}
        text={p.text}
        seriesLabel={p.seriesLabel}
        blogHandle={p.blogHandle}
        showViewAll={p.showViewAll}
        articles={p.resolved ?? []}
      />
    ),
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 64, padBottom: 64 }),
      },
      resolveData: async ({ props }) => ({
        props: {
          resolved:
            props.blogHandle && loaders.loadArticles
              ? await loaders.loadArticles({ blogHandle: props.blogHandle, limit: props.limit })
              : [],
        },
        readOnly: { resolved: true },
      }),
    },
  )
}
