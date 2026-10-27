import { AudioEngine } from './AudioEngine'
import { BuzzLayer } from './buzz'
import { Music } from './music'
import { createSfx } from './sfx'
import { WeatherLayer } from './weather'

export const audio = new AudioEngine()
export const sfx = createSfx(audio)
export const buzz = new BuzzLayer(audio)
export const weather = new WeatherLayer(audio)
export const music = new Music(audio)
