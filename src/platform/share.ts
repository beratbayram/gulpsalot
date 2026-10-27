export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Opens the system share sheet where there is one (most phones), otherwise
 * copies the text to the clipboard. Swap for @capacitor/share in native builds.
 */
export async function share(text: string, url: string): Promise<ShareResult> {
  const data = { text, url }
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(data) !== false) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
