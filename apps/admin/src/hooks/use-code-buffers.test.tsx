// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const files = vi.fn()
const read = vi.fn()
vi.mock('@/lib/api-client', () => ({ api: { themes: { code: { files, read } } } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { isDirty, useCodeBuffers } = await import('./use-code-buffers')

const PATH = 'sections/announcement-bar.liquid'

/** What the editor's textarea reports back for a text: the browser's API value. */
function textareaValue(text: string): string {
  const area = document.createElement('textarea')
  area.value = text
  return area.value
}

async function openFile(body: string) {
  files.mockResolvedValue({ kind: 'imported', drafts: 0, files: [], libraryUse: {} })
  read.mockResolvedValue({ path: PATH, body })
  const hook = renderHook(() => useCodeBuffers('t1'))
  await act(() => hook.result.current.open(PATH))
  await waitFor(() => expect(hook.result.current.buffers[PATH]).toBeDefined())
  return hook
}

describe('useCodeBuffers', () => {
  it.each([
    ['LF', '{% liquid %}\n<div>\n  hi\n</div>\n'],
    ['CRLF', '{% liquid %}\r\n<div>\r\n  hi\r\n</div>\r\n'],
  ])('is clean again after typing and undoing back to the saved text (%s)', async (_, body) => {
    const { result } = await openFile(body)
    const original = textareaValue(result.current.buffers[PATH]?.text ?? '')
    expect(isDirty(result.current.buffers[PATH] as never)).toBe(false)

    // Typing "ZZZ" fires one change per key; Ctrl+Z then reports the original text in one step.
    for (const typed of ['Z', 'ZZ', 'ZZZ']) {
      act(() => result.current.edit(PATH, textareaValue(`${original}${typed}`)))
    }
    expect(isDirty(result.current.buffers[PATH] as never)).toBe(true)
    act(() => result.current.edit(PATH, textareaValue(original)))
    expect(isDirty(result.current.buffers[PATH] as never)).toBe(false)
  })
})
