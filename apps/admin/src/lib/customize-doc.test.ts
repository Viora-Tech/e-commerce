import { describe, expect, it } from 'vitest'
import { createCustomizeConfig } from './customize-config'
import { type CustomizeDoc, HEADER_ZONE, normalizeDoc } from './customize-doc'

const lexical = (text: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        textStyle: '',
        children: [
          { type: 'text', text, format: 1, detail: 0, mode: 'normal', style: '', version: 1 },
        ],
      },
    ],
  },
})

describe('normalizeDoc', () => {
  it('hands Puck HTML for body copy the retired Lexical field saved, slots and zones included', () => {
    const doc: CustomizeDoc = {
      root: { props: {} },
      content: [
        { type: 'RichText', props: { id: 'rt', heading: 'Story', body: lexical('Hello') } },
        {
          type: 'Group',
          props: {
            id: 'g',
            content: [
              { type: 'Text', props: { id: 't', body: JSON.stringify(lexical('Nested')) } },
            ],
          },
        },
      ],
      zones: { [HEADER_ZONE]: [] },
    }
    const out = normalizeDoc(doc, createCustomizeConfig())
    expect(out.content[0]?.props.body).toBe('<p><strong>Hello</strong></p>')
    expect(out.content[0]?.props.heading).toBe('Story')
    const group = out.content[1]?.props.content as { props: { body: unknown } }[] | undefined
    const nested = group?.[0]
    expect(nested?.props.body).toBe('<p><strong>Nested</strong></p>')
  })

  it('leaves HTML and plain strings as they are', () => {
    const doc: CustomizeDoc = {
      root: { props: {} },
      content: [{ type: 'RichText', props: { id: 'rt', body: '<p>Already</p>' } }],
      zones: {},
    }
    expect(normalizeDoc(doc, createCustomizeConfig()).content[0]?.props.body).toBe('<p>Already</p>')
  })
})
