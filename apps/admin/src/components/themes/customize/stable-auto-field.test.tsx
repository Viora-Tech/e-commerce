// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import type { ComponentType, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CUSTOMIZE_OVERRIDES } from '@/lib/customize-overrides'
import StableAutoField from './stable-auto-field'

const seen: ((value: unknown) => void)[] = []
vi.mock('@puckeditor/core', async (original) => ({
  ...(await original<typeof import('@puckeditor/core')>()),
  AutoField: ({ onChange }: { onChange: (value: unknown) => void }) => {
    seen.push(onChange)
    return null
  },
}))
vi.mock('@/lib/customize-dynamic-fields', () => ({ withDynamicSources: (o: unknown) => o }))

const FIELD = { type: 'richtext', label: 'Body' } as const

describe('StableAutoField', () => {
  // Puck's rich text editor re-sends its last edit whenever onChange changes; a new arrow per
  // render looped until React stopped it (#185, accordion body in Product information).
  it('hands Puck one onChange across renders and calls the latest prop', () => {
    seen.length = 0
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<StableAutoField field={FIELD} value="<p>a</p>" onChange={first} />)
    rerender(<StableAutoField field={FIELD} value="<p>b</p>" onChange={second} />)
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(new Set(seen).size).toBe(1)
    seen[0]?.('<p>c</p>')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('<p>c</p>')
  })
})

describe('fieldLabel override', () => {
  // Puck draws a richtext field's editor inside its label; dropping the children left
  // "Offer panel steps" with a label and no editor.
  it('keeps the control Puck draws inside the label', () => {
    const Label = CUSTOMIZE_OVERRIDES.fieldLabel as ComponentType<{
      label: string
      children: ReactNode
    }>
    render(
      <Label label="Offer panel steps">
        <div>editor</div>
      </Label>,
    )
    expect(screen.getByText('editor')).toBeTruthy()
    expect(screen.queryByText('Offer panel steps')).toBeNull()
  })
})
