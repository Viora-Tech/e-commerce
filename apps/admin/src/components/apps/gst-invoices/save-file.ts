/** Hand a File from the API to the browser as a download, or open it for printing. */
export function saveFile(file: File, mode: 'download' | 'open' = 'download'): void {
  const url = URL.createObjectURL(file)
  if (mode === 'open') {
    window.open(url, '_blank', 'noopener')
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
