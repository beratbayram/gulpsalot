import { AudioEngine } from './AudioEngine'
import { BuzzLayer } from './buzz'
import { createSfx } from './sfx'

export const audio = new AudioEngine()
export const sfx = createSfx(audio)
export const buzz = new BuzzLayer(audio)
