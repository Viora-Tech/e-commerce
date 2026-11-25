// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import ImageField from './image-field'

const upload = vi.hoisted(() => ({ uploadFile: vi.fn(), rejectReason: vi.fn(() => null) }))
vi.mock('@/lib/upload', () => upload)
const picked = vi.hoisted(() => ({ next: null as { url: string; alt: string | null } | null }))
vi.mock('@/components/media/media-pick-dialog', () => ({
  default: ({ onPick }: { onPick: (m: unknown) => void }) => (
    <button type="button" onClick={() => onPick(picked.next)}>
      pick
    </button>
  ),
}))
vi.mock('./image-focal-preview', () => ({ default: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const copy = customizeContent.image
let latest: Record<string, unknown> = {}

function Harness({ start = {} }: { start?: Record<string, unknown> }) {
  const [value, setValue] = useState<unknown>(start)
  latest = value as Record<string, unknown>
  return <ImageField value={value} onChange={setValue} />
}

beforeEach(() => {
  upload.uploadFile.mockReset()
  latest = {}
})

describe('ImageField drop upload', () => {
  it('keeps alt text typed while the dropped picture uploads', async () => {
    let finish: (v: { url: string; alt: string | null }) => void = () => undefined
    upload.uploadFile.mockReturnValue(
      new Promise((r) => {
        finish = r
      }),
    )
    render(<Harness />)
    const file = new File(['x'], 'pad.png', { type: 'image/png' })
    const target = screen.getByText(copy.drop).closest('div.relative') as HTMLElement
    await act(async () => {
      fireEvent.drop(target, { dataTransfer: { files: [file] } })
    })
    fireEvent.change(screen.getByLabelText(copy.alt), { target: { value: 'Blue glass pad' } })
    await act(async () => finish({ url: 'https://cdn.x/pad.webp', alt: null }))
    expect(latest).toMatchObject({ url: 'https://cdn.x/pad.webp', alt: 'Blue glass pad' })
  })
})

describe('ImageField replace', () => {
  const old = { url: 'https://cdn.x/old.webp', alt: 'Red pad on a desk' }

  it("takes the new picture's own alt text", () => {
    picked.next = { url: 'https://cdn.x/new.webp', alt: 'Blue pad' }
    render(<Harness start={old} />)
    fireEvent.click(screen.getByText('pick'))
    expect(latest).toMatchObject({ url: 'https://cdn.x/new.webp', alt: 'Blue pad' })
  })

  it('leaves alt empty when the new picture has none', () => {
    picked.next = { url: 'https://cdn.x/new.webp', alt: null }
    render(<Harness start={old} />)
    fireEvent.click(screen.getByText('pick'))
    expect(latest).toMatchObject({ url: 'https://cdn.x/new.webp', alt: '' })
  })
})
