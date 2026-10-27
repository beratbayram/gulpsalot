import { clamp } from '../lib/math'
import { CONFIG } from './config'

export interface Layout {
  /** Canvas size in CSS pixels. */
  viewW: number
  viewH: number
  /** Logical world size. Width is fixed; height follows the screen aspect within limits. */
  worldW: number
  worldH: number
  scale: number
  offsetX: number
  offsetY: number
  /** Landmarks in world units. */
  waterY: number
  padY: number
  flyTop: number
  flyBottom: number
}

export function computeLayout(viewW: number, viewH: number): Layout {
  const { width, minHeight, maxHeight, flyTop, padFromBottom, waterFromBottom } = CONFIG.world
  const w = Math.max(1, viewW)
  const h = Math.max(1, viewH)
  const worldH = Math.round(clamp((width * h) / w, minHeight, maxHeight))
  const scale = Math.min(w / width, h / worldH)
  const padY = worldH - padFromBottom
  return {
    viewW: w,
    viewH: h,
    worldW: width,
    worldH,
    scale,
    offsetX: (w - width * scale) / 2,
    offsetY: (h - worldH * scale) / 2,
    waterY: worldH - waterFromBottom,
    padY,
    flyTop,
    // Keep insects above Gulpsalot's head so every one of them is reachable.
    flyBottom: padY - 190,
  }
}

export function toWorld(layout: Layout, cssX: number, cssY: number) {
  return {
    x: (cssX - layout.offsetX) / layout.scale,
    y: (cssY - layout.offsetY) / layout.scale,
  }
}
