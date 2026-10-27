import type { HatId } from '../cosmetics'

/**
 * Hats as plain shape data, so the game (Pixi) and the UI (SVG) draw the
 * exact same art. Coordinates are in Pofik's body space, relative to the top
 * of his head between the eyes; the eye bumps peak around (±36, 0).
 * Shapes with `outline` get an ink stroke.
 */
export type HatShape =
  | { type: 'path'; d: string; fill?: number; line?: number; width?: number; outline?: boolean }
  | { type: 'circle'; x: number; y: number; r: number; fill: number; outline?: boolean }
  | {
      type: 'ellipse'
      x: number
      y: number
      rx: number
      ry: number
      fill: number
      outline?: boolean
    }

export interface HatArt {
  x: number
  y: number
  /** Radians. */
  rotation: number
  shapes: HatShape[]
}

export const HAT_OUTLINE = 3

export const HAT_ART: Record<Exclude<HatId, 'none'>, HatArt> = {
  sprout: {
    x: 0,
    y: 0,
    rotation: 0.06,
    shapes: [
      { type: 'path', d: 'M0 20 C1 8 -2 -2 2 -14', line: 0x26313d, width: 9 },
      { type: 'path', d: 'M0 20 C1 8 -2 -2 2 -14', line: 0x5f9f45, width: 4.5 },
      {
        type: 'path',
        d: 'M2 -14 C-8 -32 -28 -30 -34 -16 C-24 -6 -8 -6 2 -14 Z',
        fill: 0x86d47c,
        outline: true,
      },
      {
        type: 'path',
        d: 'M2 -14 C8 -36 30 -40 37 -27 C31 -12 14 -8 2 -14 Z',
        fill: 0x62bd5f,
        outline: true,
      },
      { type: 'path', d: 'M-2 -15 C-12 -20 -20 -20 -27 -17', line: 0x4f9a4c, width: 2 },
      { type: 'path', d: 'M6 -17 C14 -24 22 -28 30 -27', line: 0x3f8a42, width: 2 },
    ],
  },
  bow: {
    x: 30,
    y: -4,
    rotation: 0.3,
    shapes: [
      { type: 'path', d: 'M-2 2 L-11 18 L-4 15 L-1 20 Z', fill: 0xff7096, outline: true },
      { type: 'path', d: 'M2 2 L11 18 L4 15 L1 20 Z', fill: 0xff7096, outline: true },
      {
        type: 'path',
        d: 'M0 0 C-6 -15 -25 -17 -25 -2 C-25 11 -8 8 0 0 Z',
        fill: 0xff7096,
        outline: true,
      },
      {
        type: 'path',
        d: 'M0 0 C6 -15 25 -17 25 -2 C25 11 8 8 0 0 Z',
        fill: 0xff7096,
        outline: true,
      },
      { type: 'path', d: 'M-19 -6 C-16 -10 -11 -10 -8 -7', line: 0xffc6d6, width: 2.5 },
      { type: 'path', d: 'M19 -6 C16 -10 11 -10 8 -7', line: 0xffc6d6, width: 2.5 },
      { type: 'ellipse', x: 0, y: 0, rx: 6, ry: 7, fill: 0xff97b6, outline: true },
    ],
  },
  party: {
    x: 0,
    y: 0,
    rotation: -0.12,
    shapes: [
      { type: 'path', d: 'M-24 6 L4 -60 L24 6 Q0 14 -24 6 Z', fill: 0x5fb4ec, outline: true },
      { type: 'circle', x: -8, y: -4, r: 4.5, fill: 0xffc93c },
      { type: 'circle', x: 11, y: -12, r: 4, fill: 0xff7096 },
      { type: 'circle', x: -1, y: -28, r: 3.6, fill: 0xffc93c },
      { type: 'circle', x: 8, y: 3, r: 3.2, fill: 0xffffff },
      { type: 'circle', x: 5, y: -44, r: 3, fill: 0xff7096 },
      { type: 'circle', x: 4, y: -62, r: 8, fill: 0xffc93c, outline: true },
    ],
  },
  crown: {
    x: 0,
    y: -6,
    rotation: 0.08,
    shapes: [
      {
        type: 'path',
        d: 'M-30 10 L-34 -18 L-15 -3 L0 -29 L15 -3 L34 -18 L30 10 Z',
        fill: 0xffc93c,
        outline: true,
      },
      { type: 'path', d: 'M-30.8 2 L30.8 2 L30 10 L-30 10 Z', fill: 0xf0a52c, outline: true },
      { type: 'path', d: 'M-24 -6 L-25 -11', line: 0xfff1b8, width: 3 },
      { type: 'circle', x: -34, y: -18, r: 4.2, fill: 0xfff1b8, outline: true },
      { type: 'circle', x: 0, y: -29, r: 5, fill: 0xfff1b8, outline: true },
      { type: 'circle', x: 34, y: -18, r: 4.2, fill: 0xfff1b8, outline: true },
      { type: 'circle', x: 0, y: 6, r: 3.2, fill: 0xff7096 },
      { type: 'circle', x: -17, y: 6, r: 2.4, fill: 0x5fb4ec },
      { type: 'circle', x: 17, y: 6, r: 2.4, fill: 0x5fb4ec },
    ],
  },
  // Floppy striped sleeping cap that droops to one side, with a pompom.
  nightcap: {
    x: 0,
    y: -2,
    rotation: -0.1,
    shapes: [
      {
        type: 'path',
        d: 'M-30 8 C-26 -24 10 -40 30 -22 C40 -12 44 4 40 16 C34 4 26 -6 18 -6 C24 0 28 6 30 8 Z',
        fill: 0x5f7fe0,
        outline: true,
      },
      { type: 'path', d: 'M-14 -14 C-6 -22 6 -24 14 -20', line: 0xa8bcff, width: 5 },
      { type: 'path', d: 'M-22 -2 C-12 -12 4 -14 16 -10', line: 0xa8bcff, width: 5 },
      { type: 'path', d: 'M-32 4 Q0 -4 32 6 L31 14 Q0 6 -31 12 Z', fill: 0xf4f7ff, outline: true },
      { type: 'circle', x: 41, y: 18, r: 7, fill: 0xf4f7ff, outline: true },
    ],
  },
  // A big feather tucked behind one eye, the tickle trophy.
  feather: {
    x: 26,
    y: 2,
    rotation: 0.35,
    shapes: [
      {
        type: 'path',
        d: 'M0 10 C-14 -6 -12 -40 6 -62 C18 -40 16 -8 0 10 Z',
        fill: 0xff9fc4,
        outline: true,
      },
      { type: 'path', d: 'M0 10 C2 -14 4 -38 6 -60', line: 0xd9558c, width: 2.5 },
      {
        type: 'path',
        d: 'M2 -20 L-8 -28 M3 -34 L-6 -42 M3 -20 L12 -30 M4 -36 L11 -44',
        line: 0xd9558c,
        width: 1.8,
      },
    ],
  },
}

/** Where the hat sits in Pofik's body space (the top of his head). */
export const HAT_ANCHOR = { x: 0, y: -138 }
