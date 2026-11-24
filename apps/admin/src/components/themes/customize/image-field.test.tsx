// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import ImageField from './image-field'

const upload = vi.hoisted(() => ({ uploadFile: vi.fn(), rejectReason: vi.fn(() => null) }))
vi.mock('@/lib/upload', () => upload)
vi.mock('@/components/media/media-pick-dialog', () => ({ default: () => null }))
vi.mock('./image-focal-preview', () => ({ default: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const copy = customizeContent.image
let latest: Record<string, unknown> = {}

function Harness() {
  const [value, setValue] = useState<unknown>({})
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
