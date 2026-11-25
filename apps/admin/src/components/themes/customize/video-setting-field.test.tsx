// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VideoSettingField from './video-setting-field'

const media = vi.hoisted(() => ({ posterFor: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ api: { media } }))
vi.mock('./image-field', () => ({ default: () => null }))
vi.mock('@puckeditor/core', () => ({
  AutoField: ({
    field,
    value,
    onChange,
  }: {
    field: { label: string }
    value: unknown
    onChange: (v: unknown) => void
  }) => (
    <input
      aria-label={field.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

const fields = {
  url: { type: 'text', label: 'Video link' },
  mobileUrl: { type: 'text', label: 'Mobile video link' },
  poster: { type: 'object', label: 'Poster', objectFields: {} },
} as never

let latest: Record<string, unknown> = {}

function Harness() {
  const [value, setValue] = useState<unknown>({})
  latest = value as Record<string, unknown>
  return <VideoSettingField label="Video" objectFields={fields} value={value} onChange={setValue} />
}

/** A poster lookup the test answers when it chooses. */
function deferred() {
  let resolve: (v: { url: string } | null) => void = () => undefined
  const promise = new Promise<{ url: string } | null>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  media.posterFor.mockReset()
  latest = {}
})

describe('VideoSettingField poster lookup', () => {
  it('keeps edits made while the poster was being looked up', async () => {
    const lookup = deferred()
    media.posterFor.mockReturnValue(lookup.promise)
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Video link'), {
      target: { value: 'https://cdn.x/a.mp4' },
    })
    fireEvent.change(screen.getByLabelText('Mobile video link'), {
      target: { value: 'https://cdn.x/a-mobile.mp4' },
    })
    await act(async () => lookup.resolve({ url: 'https://cdn.x/a.webp' }))
    expect(latest).toMatchObject({
      url: 'https://cdn.x/a.mp4',
      mobileUrl: 'https://cdn.x/a-mobile.mp4',
      poster: { url: 'https://cdn.x/a.webp' },
    })
  })

  it('drops a poster that belongs to a link already replaced', async () => {
    const first = deferred()
    const second = deferred()
    media.posterFor.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(<Harness />)
    const input = screen.getByLabelText('Video link')
    fireEvent.change(input, { target: { value: 'https://cdn.x/old.mp4' } })
    fireEvent.change(input, { target: { value: 'https://cdn.x/new.mp4' } })
    await act(async () => second.resolve(null))
    await act(async () => first.resolve({ url: 'https://cdn.x/old.webp' }))
    expect(latest.url).toBe('https://cdn.x/new.mp4')
    expect(latest.poster).toBeUndefined()
  })
})
