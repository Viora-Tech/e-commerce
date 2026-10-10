// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import { type InspectorTab, InspectorTabContext } from '@/lib/customize-inspector-tab'
import InspectorFields from './inspector-fields'

const copy = customizeContent.inspector

const SETTINGS = { type: 'object', objectFields: { spacing: {}, advanced: {} } }

const puck = {
  selectedItem: { type: 'Hero', props: { id: 'hero-1' } } as { type: string } | null,
  config: {
    components: {
      Hero: { fields: { heading: { type: 'text' }, settings: SETTINGS } },
      RichText: { fields: { text: { type: 'textarea' } } },
    },
  },
}
vi.mock('@/lib/customize-puck', async (original) => ({
  ...(await original<typeof import('@/lib/customize-puck')>()),
  useCustomizePuck: (select: (s: typeof puck) => unknown) => select(puck),
}))

// Puck keys each field element by its field name.
function draw(tab: InspectorTab | 'all', names: string[]) {
  render(
    <InspectorTabContext.Provider value={tab}>
      <InspectorFields>
        {names.map((name) => (
          <p key={name} data-testid="field">
            {name}
          </p>
        ))}
      </InspectorFields>
    </InspectorTabContext.Provider>,
  )
  return screen.queryAllByTestId('field').map((el) => el.textContent)
}

beforeEach(() => {
  puck.selectedItem = { type: 'Hero', props: { id: 'hero-1' } } as never
})

describe('InspectorFields', () => {
  it('puts the Basic fields in one Content card (Figma 381:6222)', () => {
    expect(draw('basic', ['heading', 'settings'])).toEqual(['heading'])
    expect(screen.getByRole('button', { name: copy.content })).toBeTruthy()
  })

  it('draws only the shared settings on Advanced, each group its own card, no Content card', () => {
    expect(draw('advanced', ['heading', 'settings'])).toEqual(['settings'])
    expect(screen.queryByRole('button', { name: copy.content })).toBeNull()
  })

  it('shows every field in the Content card when the section has no Advanced settings', () => {
    puck.selectedItem = { type: 'RichText', props: { id: 'text-1' } } as never
    expect(draw('all', ['text'])).toEqual(['text'])
    expect(screen.getByRole('button', { name: copy.content })).toBeTruthy()
  })
})
