/** Family names registered by @fontsource-variable/inter and /fraunces. */
export const GAME_FONT = 'Inter Variable'
export const DISPLAY_FONT = 'Fraunces Variable'

/** Pixi renders text to canvas, so the font must be ready before the first Text is drawn. */
export async function loadGameFont() {
  try {
    await Promise.all([
      document.fonts.load(`700 32px "${GAME_FONT}"`),
      document.fonts.load(`600 20px "${GAME_FONT}"`),
      document.fonts.load(`600 48px "${DISPLAY_FONT}"`),
    ])
  } catch {
    // Falls back to the system font; the game still works.
  }
}
