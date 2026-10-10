// @vitest-environment jsdom
import { defaultTheme, schemeFor, type Theme } from '@commerce/core/theme'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { customizeContent } from '@/data/customize'
import { CORNER_RADII, SIZE_SCALES } from '@/lib/theme-quick-settings'
import ThemePanel from './theme-panel'

const copy = customizeContent.themePanel

function setup(theme: Theme = defaultTheme) {
  const onChange = vi.fn()
  render(<ThemePanel theme={theme} mode="light" onChange={onChange} />)
  return { onChange, user: userEvent.setup() }
}

describe('ThemePanel', () => {
  it('shows the five Figma swatches with their codes', () => {
    setup()
    const scheme = schemeFor(defaultTheme, 'light')
    expect(screen.getByLabelText<HTMLInputElement>(copy.hexOf(copy.swatches.brand)).value).toBe(
      scheme.button,
    )
    expect(screen.getByLabelText<HTMLInputElement>(copy.hexOf(copy.swatches.text)).value).toBe(
      scheme.text,
    )
    expect(
      screen.getByRole('button', { name: new RegExp(`^${copy.swatches.buttons}\\s*#`) }),
    ).toBeTruthy()
  })

  it('keeps a typed colour code only once it is a whole colour', () => {
    const { onChange } = setup()
    const box = screen.getByLabelText(copy.hexOf(copy.swatches.accent))
    fireEvent.change(box, { target: { value: '#12' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: 'f59e0b' } })
    const next: Theme = onChange.mock.calls[0]?.[0]
    expect(schemeFor(next, 'light').accent).toBe('#F59E0B')
  })

  it('sets the type size and the button corners from their simple choices', async () => {
    const { onChange, user } = setup()
    await user.click(screen.getByRole('radio', { name: copy.sizes.l }))
    expect(onChange.mock.calls[0]?.[0].fonts).toMatchObject(SIZE_SCALES.l)
    await user.click(screen.getByRole('radio', { name: copy.corners.round }))
    expect(onChange.mock.calls[1]?.[0].shape.buttonRadius).toBe(CORNER_RADII.round)
  })

  it('switches filled and outline buttons', async () => {
    const { onChange, user } = setup()
    await user.click(screen.getByRole('radio', { name: copy.styles.outline }))
    expect(onChange.mock.calls[0]?.[0].buttons.style).toBe('outline')
  })

  it('offers reset only once something differs from the preset', () => {
    setup()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: copy.reset }).disabled).toBe(true)
  })
})
