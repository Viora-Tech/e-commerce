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

const open = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: copy.open(name) }))

describe('ThemePanel', () => {
  it('lists the groups with what each is set to, and opens one in place', async () => {
    const { user } = setup()
    expect(screen.getByRole('button', { name: copy.open(copy.typography) }).textContent).toContain(
      'size',
    )
    open(copy.colours)
    expect(screen.getByRole('heading', { name: copy.colours })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: copy.back }))
    expect(screen.getByRole('button', { name: copy.open(copy.colours) })).toBeTruthy()
  })

  it('offers Undo after a preset, bringing back the theme it replaced', async () => {
    const { onChange, user } = setup()
    await user.click(screen.getByRole('button', { name: /Bold/ }))
    expect(onChange.mock.calls[0]?.[0].preset).toBe('bold')
    await user.click(screen.getByRole('button', { name: copy.undo }))
    expect(onChange.mock.calls[1]?.[0]).toEqual(defaultTheme)
  })

  it('shows the five Figma swatches with their codes', () => {
    setup()
    open(copy.colours)
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
    open(copy.colours)
    const box = screen.getByLabelText(copy.hexOf(copy.swatches.accent))
    fireEvent.change(box, { target: { value: '#12' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: 'f59e0b' } })
    const next: Theme = onChange.mock.calls[0]?.[0]
    expect(schemeFor(next, 'light').accent).toBe('#F59E0B')
  })

  it('sets the type size and the button corners from their simple choices', async () => {
    const { onChange, user } = setup()
    open(copy.typography)
    await user.click(screen.getByRole('radio', { name: copy.sizes.l }))
    expect(onChange.mock.calls[0]?.[0].fonts).toMatchObject(SIZE_SCALES.l)
    await user.click(screen.getByRole('button', { name: copy.back }))
    open(copy.buttons)
    await user.click(screen.getByRole('radio', { name: copy.corners.round }))
    expect(onChange.mock.calls[1]?.[0].shape.buttonRadius).toBe(CORNER_RADII.round)
  })

  it('switches filled and outline buttons', async () => {
    const { onChange, user } = setup()
    open(copy.buttons)
    await user.click(screen.getByRole('radio', { name: copy.styles.outline }))
    expect(onChange.mock.calls[0]?.[0].buttons.style).toBe('outline')
  })

  it('offers reset only once something differs from the preset', () => {
    setup()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: copy.reset }).disabled).toBe(true)
  })
})
