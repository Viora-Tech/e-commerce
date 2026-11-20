/**
 * Shows a made file (a label sheet, a manifest) in the tab opened on the click, else saves it
 * (a blocked pop-up). The object URL is freed after a minute, once the tab has read it.
 */
export function showFile(file: File, tab: Window | null) {
  const url = URL.createObjectURL(file)
  if (tab && !tab.closed) {
    tab.location.href = url
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
