import { Container, FillGradient, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { TAU, clamp, damp, easeOutCubic, lerp, mixColor } from '../../lib/math'
import { createNoise1D } from '../../lib/noise'
import { Rng } from '../../lib/random'
import type { DecorId } from '../cosmetics'
import { PALETTE } from '../draw/palette'
import { GAME_FONT } from '../fonts'
import type { Layout } from '../layout'
import type { Weather } from '../weather'

/** Extra margin so letterboxed screens still see scenery instead of empty bars. */
const BLEED = 320

interface Drifter {
  g: Container
  speed: number
  span: number
}

interface Reed {
  g: Graphics
  phase: number
  amp: number
  speed: number
}

interface Glint {
  g: Graphics
  x: number
  phase: number
}

interface Mote {
  g: Graphics
  x: number
  y: number
  seed: number
}

interface Star {
  g: Graphics
  phase: number
  speed: number
}

const MOON_X = 72
const MOON_NIGHT_Y = 176

/** Scenery tint at dusk and at night. Multiplies everything below the sky. */
const DUSK_AMBIENT = 0xffd9c4
const NIGHT_AMBIENT = 0x98a6d6
const DUSK_CLOUD = 0xffc0c8
const NIGHT_CLOUD = 0x56648f

interface Drop {
  x: number
  y: number
  len: number
  speed: number
}

interface Leaf {
  g: Graphics
  x: number
  y: number
  spin: number
  seed: number
}

interface Fog {
  s: Sprite
  x: number
  speed: number
}

/** Pond neighbours that react to what happens in the run. */
interface Critters {
  duck: Container
  duckX: number
  duckDir: number
  duckHop: number
  turtle: Container
  turtleHead: Graphics
  /** 1 = head out, 0 = hidden in the shell. */
  turtleOut: number
  turtleHide: number
  frog: Container
  frogThroat: Graphics
  croak: number
}

const RAIN_SKY = 0x9aa8b8
const RAIN_AMBIENT = 0xb9c4d2

interface Ripple {
  g: Graphics
  x: number
  y: number
  t: number
  strength: number
  active: boolean
}

/** The whole backdrop: sky, clouds, hills, water, reeds and the lily pad Gulpsalot sits on. */
export class Pond {
  /** Behind Gulpsalot and the insects. */
  readonly back = new Container()
  /** In front of everything except effects (foreground reeds). */
  readonly front = new Container()
  /** Weather drawn over the whole scene: rain, fog, blowing leaves. */
  readonly overlay = new Container()
  /** Current time-of-day tint, for things drawn outside the pond (Gulpsalot, insects). */
  ambient = 0xffffff
  /** What moths circle at night: where the moon settles. */
  readonly light = { x: MOON_X, y: MOON_NIGHT_Y }
  private decor: readonly DecorId[] = []
  private best = 0
  /** Glows drawn on top of the tinted scenery, so they stay bright at night. */
  private lights = new Container()
  private lanternGlow: Sprite | null = null
  private signText: Text | null = null

  private readonly rng = new Rng(7)
  private readonly wind = createNoise1D(11)
  private readonly drift = createNoise1D(23)
  private time = 0
  private layout!: Layout

  private sky = new Container()
  private scenery = new Container()
  private duskSky = new Graphics()
  private nightSky = new Graphics()
  private stars: Star[] = []
  private moon = new Container()
  private skyPhase = 0
  private skyTarget = 0
  private sunY = 0
  private clouds: Drifter[] = []
  private sun = new Container()
  private reeds: Reed[] = []
  private glints: Glint[] = []
  private motes: Mote[] = []
  private ripples: Ripple[] = []
  private smallPads: { c: Container; y: number }[] = []
  private lily = new Container()
  private pad = new Container()
  private ambientRipple = 1.5
  private rainSky = new Graphics()
  private rain = new Graphics()
  private drops: Drop[] = []
  private leaves: Leaf[] = []
  private fogs: Fog[] = []
  private critters: Critters | null = null
  private weather: Weather = 'clear'
  /** 0..1, eased towards the current weather. */
  private rainAmount = 0
  private fogAmount = 0
  private fogTarget = 0
  private leafAmount = 0
  private windForce = 0

  /** Vertical bob of the main pad, used to keep Gulpsalot seated on it. */
  padBob = 0

  build(layout: Layout) {
    this.layout = layout
    for (const c of [this.back, this.front, this.overlay]) {
      c.removeChildren().forEach((child) => child.destroy({ children: true }))
    }
    // Rebuilt from scratch: the old ones were destroyed with their parent's children.
    this.sky = new Container()
    this.scenery = new Container()
    this.moon = new Container()
    this.stars = []
    this.sun = new Container()
    this.pad = new Container()
    this.lily = new Container()
    this.clouds = []
    this.reeds = []
    this.glints = []
    this.motes = []
    this.ripples = []
    this.smallPads = []
    this.leaves = []
    this.fogs = []
    this.drops = []

    const { worldW: W, worldH: H, waterY, padY } = layout

    // The sky keeps its own colors; everything below it is tinted by time of day.
    this.back.addChild(this.sky, this.scenery)
    this.buildSky(W, waterY)
    this.buildSun(W)
    this.buildMoon()
    this.buildClouds(W, waterY)
    this.scenery.addChild(this.drawHills(W, waterY))
    this.buildReeds(this.scenery, W, waterY, false)
    this.scenery.addChild(this.drawWater(W, H, waterY))
    this.buildGlints(W, H, waterY)
    this.buildSmallPads(W, waterY, padY)
    this.buildCritters(W, waterY)
    this.buildRipples()
    this.buildMainPad(W, padY)
    this.buildLily(padY)
    this.buildMotes(W, waterY)
    this.buildReeds(this.front, W, H, true)
    this.buildWeather(W, H, waterY)
    this.buildDecor(W, waterY, padY)
    this.applySky(0)
  }

  /** Which decorations stand in the pond. The sign shows `best`. */
  setDecor(decor: readonly DecorId[], best: number) {
    const same = decor.length === this.decor.length && decor.every((d) => this.decor.includes(d))
    this.best = best
    if (same) {
      if (this.signText) this.signText.text = String(best)
      return
    }
    this.decor = [...decor]
    if (this.layout) this.build(this.layout)
  }

  /** Rain, wind or fog for this run. Changes ease in and out. */
  setWeather(weather: Weather) {
    this.weather = weather
  }

  /** How thick the fog is (it lifts as a run goes on). */
  setFog(level: number) {
    this.fogTarget = level
  }

  /** Sideways wind, in the same units insects use. */
  setWind(force: number) {
    this.windForce = force
  }

  /** Something startling happened (a sting): the duck jumps and the turtle hides. */
  startle() {
    const c = this.critters
    if (!c) return null
    c.duckHop = 1
    c.turtleHide = 3
    return c.duckX
  }

  /** A big moment (a high combo): the far frog croaks along. */
  cheer() {
    const c = this.critters
    if (!c || c.croak > 0) return null
    c.croak = 1.2
    return c.frog.x
  }

  /** 0 = day, 1 = dusk, 2 = night. The sky eases towards it. */
  setSky(phase: number) {
    this.skyTarget = phase
  }

  /** Expanding ring on the water. */
  ripple(x: number, y: number, strength = 1) {
    const r = this.ripples.find((it) => !it.active) ?? this.ripples[0]
    r.active = true
    r.t = 0
    r.x = x
    r.y = y
    r.strength = strength
    r.g.visible = true
  }

  update(dt: number) {
    this.time += dt
    const t = this.time
    const { worldW: W, padY } = this.layout
    this.updateWeather(dt)
    this.updateCritters(dt)

    this.skyPhase = damp(this.skyPhase, this.skyTarget, 1.4, dt)
    if (Math.abs(this.skyPhase - this.skyTarget) < 0.0005) this.skyPhase = this.skyTarget
    this.applySky(dt)

    for (const c of this.clouds) {
      c.g.x += (c.speed + this.windForce * 0.25) * dt
      if (c.g.x > W + c.span) c.g.x = -c.span
      if (c.g.x < -c.span - 10) c.g.x = W + c.span
    }

    this.sun.scale.set(1 + Math.sin(t * 0.9) * 0.025)
    this.sun.rotation = t * 0.05
    this.moon.rotation = Math.sin(t * 0.4) * 0.04

    const gust = 0.5 + 0.5 * this.wind(t * 0.18)
    const push = this.windForce / 300
    for (const r of this.reeds) {
      const sway = Math.sin(t * r.speed + r.phase) * r.amp * (0.55 + gust * 0.9 + Math.abs(push))
      r.g.skew.x = sway + gust * 0.05 + push * 0.6
    }

    for (const gl of this.glints) {
      gl.g.x = gl.x + Math.sin(t * 0.7 + gl.phase) * 7
      gl.g.alpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.4 + gl.phase * 2))
    }

    this.padBob = Math.sin(t * 1.3) * 2.2 + Math.sin(t * 0.47) * 1.2
    this.pad.y = padY + this.padBob
    this.pad.rotation = Math.sin(t * 0.8) * 0.006
    this.lily.y = padY + 34 + Math.sin(t * 1.1 + 1) * 2
    this.lily.rotation = Math.sin(t * 0.6) * 0.04
    this.smallPads.forEach((p, i) => (p.c.y = p.y + Math.sin(t * 1.2 + i * 2) * 1.6))

    for (const m of this.motes) {
      m.x += (8 + this.drift(m.seed + t * 0.3) * 14) * dt
      m.y += this.drift(m.seed * 3 + t * 0.25) * 10 * dt
      if (m.x > W + 20) m.x = -20
      m.g.position.set(m.x, m.y)
      m.g.alpha = 0.35 + 0.35 * Math.sin(t * 1.7 + m.seed)
    }

    this.ambientRipple -= dt * (1 + this.rainAmount * 9)
    if (this.ambientRipple <= 0) {
      this.ambientRipple = this.rng.range(2.2, 4)
      if (this.rainAmount > 0.3) {
        // Raindrops land all over the water.
        const { waterY, worldH } = this.layout
        this.ripple(this.rng.range(0, W), this.rng.range(waterY + 14, worldH - 30), 0.28)
      } else {
        const side = this.rng.sign()
        this.ripple(W / 2 + side * this.rng.range(70, 130), padY + this.rng.range(-4, 10), 0.45)
      }
    }

    for (const r of this.ripples) {
      if (!r.active) continue
      r.t += dt / (1.1 + r.strength * 0.5)
      if (r.t >= 1) {
        r.active = false
        r.g.visible = false
        continue
      }
      const k = easeOutCubic(r.t)
      const radius = 18 + 110 * k * r.strength
      r.g
        .clear()
        .ellipse(r.x, r.y, radius, radius * 0.26)
        .stroke({ width: 2.5, color: PALETTE.white, alpha: (1 - r.t) * 0.55 })
    }
  }

  private buildSky(W: number, waterY: number) {
    const layer = (stops: [number, number, number]) => {
      const g = new Graphics()
      const gradient = new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: stops[0] },
          { offset: 0.65, color: stops[1] },
          { offset: 1, color: stops[2] },
        ],
        textureSpace: 'local',
      })
      g.rect(-BLEED, -BLEED, W + BLEED * 2, waterY + BLEED + 4).fill(gradient)
      this.sky.addChild(g)
      return g
    }
    layer([PALETTE.skyTop, 0xb4e2f8, PALETTE.skyBottom])
    this.duskSky = layer([0x7d7bca, 0xf39cb0, 0xffcf94])
    this.nightSky = layer([0x16204a, 0x2b3b70, 0x4a5c94])

    for (let i = 0; i < 46; i++) {
      const g = new Graphics()
      const big = this.rng.chance(0.15)
      if (big) g.star(0, 0, 4, 4, 1.4).fill(PALETTE.white)
      else g.circle(0, 0, this.rng.range(0.8, 1.8)).fill(PALETTE.white)
      g.position.set(this.rng.range(-60, W + 60), this.rng.range(-BLEED * 0.6, waterY - 150))
      this.sky.addChild(g)
      this.stars.push({ g, phase: this.rng.range(0, TAU), speed: this.rng.range(1, 3) })
    }
  }

  private buildMoon() {
    const g = new Graphics()
    g.circle(0, 0, 40).fill({ color: 0xfff6d6, alpha: 0.12 })
    g.circle(0, 0, 30).fill({ color: 0xfff6d6, alpha: 0.18 })
    g.circle(0, 0, 22).fill(0xfff4cf)
    g.circle(-6, -5, 4.5).fill(0xeadfb8)
    g.circle(7, 6, 3).fill(0xeadfb8)
    g.circle(5, -9, 2.2).fill(0xeadfb8)
    this.moon.addChild(g)
    this.moon.position.set(MOON_X, 300)
    this.sky.addChild(this.moon)
  }

  /** Crossfades the sky layers, sets the sun and moon, and tints the scenery. */
  private applySky(dt: number) {
    const p = this.skyPhase
    const dusk = clamp(p, 0, 1)
    const night = clamp(p - 1, 0, 1)
    this.duskSky.alpha = dusk
    this.nightSky.alpha = night
    this.duskSky.visible = dusk > 0.001
    this.nightSky.visible = night > 0.001

    const sunset = easeOutCubic(clamp(p / 1.2, 0, 1))
    this.sun.y = lerp(this.sunY, this.layout.waterY - 40, sunset)
    this.sun.tint = mixColor(0xffffff, 0xff9a5c, dusk)
    this.sun.alpha = (1 - clamp((p - 0.9) / 0.5, 0, 1)) * (1 - this.rainAmount * 0.75)
    this.sun.visible = this.sun.alpha > 0.001

    const rise = easeOutCubic(clamp((p - 1.1) / 0.9, 0, 1))
    this.moon.alpha = clamp((p - 1.15) / 0.6, 0, 1)
    this.moon.y = lerp(300, MOON_NIGHT_Y, rise)
    this.moon.visible = this.moon.alpha > 0.001

    for (const s of this.stars) {
      if (night <= 0.001) {
        s.g.visible = false
        continue
      }
      s.phase += dt * s.speed
      s.g.visible = true
      s.g.alpha = night * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(s.phase)))
    }

    const cloud =
      p <= 1 ? mixColor(0xffffff, DUSK_CLOUD, dusk) : mixColor(DUSK_CLOUD, NIGHT_CLOUD, night)
    const overcast = mixColor(cloud, 0xa9b4c2, this.rainAmount * 0.65)
    for (const c of this.clouds) c.g.tint = overcast

    const daylight =
      p <= 1 ? mixColor(0xffffff, DUSK_AMBIENT, dusk) : mixColor(DUSK_AMBIENT, NIGHT_AMBIENT, night)
    // Overcast while it rains.
    this.ambient = mixColor(daylight, mixColor(daylight, RAIN_AMBIENT, 0.9), this.rainAmount * 0.55)
    this.rainSky.alpha = this.rainAmount * (0.75 - night * 0.45)
    this.rainSky.visible = this.rainSky.alpha > 0.001
    this.scenery.tint = this.ambient
    this.front.tint = this.ambient
    if (this.lanternGlow) this.lanternGlow.alpha = 0.15 + 0.75 * clamp(p - 0.6, 0, 1)
  }

  private buildWeather(W: number, H: number, waterY: number) {
    // Grey cloud cover over the sky, faded in with the rain.
    const sky = new Graphics()
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: 0x7d8a9c },
        { offset: 1, color: RAIN_SKY },
      ],
      textureSpace: 'local',
    })
    sky.rect(-BLEED, -BLEED, W + BLEED * 2, waterY + BLEED + 4).fill(gradient)
    sky.alpha = 0
    this.rainSky = sky
    // Above the sky gradients and stars, below the sun, moon and clouds.
    this.sky.addChildAt(sky, 3 + this.stars.length)

    this.rain = new Graphics()
    this.overlay.addChild(this.rain)
    for (let i = 0; i < 70; i++) {
      this.drops.push({
        x: this.rng.range(-60, W + 60),
        y: this.rng.range(-BLEED * 0.5, H),
        len: this.rng.range(14, 26),
        speed: this.rng.range(760, 980),
      })
    }

    const fogTex = softTexture()
    for (let i = 0; i < 6; i++) {
      const s = new Sprite(fogTex)
      s.anchor.set(0.5)
      s.scale.set(this.rng.range(3.4, 5), this.rng.range(1.3, 1.9))
      s.position.set(this.rng.range(0, W), lerp(140, waterY - 30, i / 5))
      s.alpha = 0
      s.visible = false
      this.overlay.addChild(s)
      this.fogs.push({ s, x: s.x, speed: this.rng.range(4, 10) * this.rng.sign() })
    }

    for (let i = 0; i < 9; i++) {
      const g = new Graphics()
      const color = this.rng.pick([PALETTE.reed, PALETTE.padLight, 0xe2b04a, 0xd98a3c])
      g.ellipse(0, 0, 7, 3.4).fill(color).stroke({ width: 1.5, color: PALETTE.ink, alpha: 0.6 })
      g.moveTo(-7, 0).lineTo(-10, 0.5).stroke({ width: 1.4, color: PALETTE.ink, alpha: 0.6 })
      g.visible = false
      this.overlay.addChild(g)
      this.leaves.push({
        g,
        x: this.rng.range(0, W),
        y: this.rng.range(150, waterY + 60),
        spin: this.rng.range(2, 5) * this.rng.sign(),
        seed: i * 7.3,
      })
    }
  }

  private updateWeather(dt: number) {
    const { worldW: W, worldH: H } = this.layout
    this.rainAmount = damp(this.rainAmount, this.weather === 'rain' ? 1 : 0, 1.2, dt)
    this.fogAmount = damp(this.fogAmount, this.weather === 'fog' ? this.fogTarget : 0, 0.8, dt)
    this.leafAmount = damp(this.leafAmount, this.weather === 'wind' ? 1 : 0, 1.5, dt)

    const g = this.rain
    g.clear()
    if (this.rainAmount > 0.01) {
      const slant = 0.18 + this.windForce / 900
      for (const d of this.drops) {
        d.y += d.speed * dt
        d.x += d.speed * slant * dt
        if (d.y > H + 20) {
          d.y = -BLEED * 0.3 - this.rng.range(0, 120)
          d.x = this.rng.range(-80, W + 40)
        }
        g.moveTo(d.x, d.y).lineTo(d.x - d.len * slant, d.y - d.len)
      }
      g.stroke({ width: 2, color: 0xe8f4ff, alpha: 0.55 * this.rainAmount, cap: 'round' })
    }

    for (const f of this.fogs) {
      f.x += f.speed * dt
      if (f.x > W + 260) f.x = -260
      if (f.x < -260) f.x = W + 260
      f.s.x = f.x
      f.s.alpha = this.fogAmount * 0.55
      f.s.visible = f.s.alpha > 0.005
    }

    for (const l of this.leaves) {
      const on = this.leafAmount > 0.02
      l.g.visible = on
      if (!on) continue
      l.x += (this.windForce * 2.2 + this.drift(l.seed + this.time) * 20) * dt
      l.y += (14 + this.drift(l.seed * 2 + this.time * 0.8) * 40) * dt
      if (l.x > W + 30) l.x = -30
      if (l.x < -30) l.x = W + 30
      if (l.y > this.layout.waterY + 80) l.y = 120
      l.g.position.set(l.x, l.y)
      l.g.rotation += l.spin * dt
      l.g.alpha = this.leafAmount
    }
  }

  private buildDecor(W: number, waterY: number, padY: number) {
    this.lights = new Container()
    this.lanternGlow = null
    this.signText = null
    this.light.x = MOON_X
    this.light.y = MOON_NIGHT_Y
    this.back.addChild(this.lights)

    if (this.decor.includes('reeds')) {
      for (const x of [W * 0.24, W * 0.7]) {
        const g = new Graphics()
        for (let i = 0; i < 4; i++) {
          const h = 46 + ((i * 17) % 22)
          const dx = (i - 1.5) * 7
          const lean = (i - 1.5) * 3
          g.moveTo(dx - 2.5, 0)
            .quadraticCurveTo(dx + lean * 0.5, -h * 0.5, dx + lean, -h)
            .quadraticCurveTo(dx + 2.5 + lean * 0.5, -h * 0.5, dx + 2.5, 0)
            .closePath()
            .fill(i % 2 ? PALETTE.reedDark : PALETTE.reed)
          if (i % 2 === 0) g.roundRect(dx + lean - 3, -h - 4, 6, 15, 3).fill(PALETTE.cattail)
        }
        g.position.set(x, waterY + 8)
        this.scenery.addChild(g)
        this.reeds.push({ g, phase: x, amp: 0.05, speed: 1.1 })
      }
    }

    if (this.decor.includes('lantern')) {
      // A lantern on a post at the left edge. Moths circle it instead of the moon.
      const lampY = padY - 210
      const x = 36
      const g = new Graphics()
      g.roundRect(x - 3, lampY, 6, waterY + 40 - lampY, 3)
        .fill(PALETTE.cattail)
        .stroke({
          width: 2,
          color: PALETTE.ink,
        })
      g.moveTo(x, lampY + 2)
        .lineTo(x + 16, lampY - 4)
        .stroke({ width: 3, color: PALETTE.ink })
      g.roundRect(x + 8, lampY - 4, 16, 22, 5)
        .fill(0xfff0b0)
        .stroke({ width: 2.5, color: PALETTE.ink })
      g.moveTo(x + 8, lampY + 6)
        .lineTo(x + 24, lampY + 6)
        .stroke({ width: 1.5, color: PALETTE.ink })
      g.roundRect(x + 10, lampY - 8, 12, 5, 2).fill(PALETTE.ink)
      this.scenery.addChild(g)
      const glow = new Sprite(softTexture())
      glow.anchor.set(0.5)
      glow.blendMode = 'add'
      glow.tint = 0xffd77a
      glow.scale.set(1.6)
      glow.position.set(x + 16, lampY + 7)
      this.lights.addChild(glow)
      this.lanternGlow = glow
      this.light.x = x + 16
      this.light.y = lampY + 7
    }

    if (this.decor.includes('sign')) {
      // A little wooden sign by the pad, showing the best score.
      const c = new Container()
      const g = new Graphics()
      g.roundRect(-3, -6, 6, 46, 3).fill(PALETTE.cattail).stroke({ width: 2, color: PALETTE.ink })
      g.roundRect(-30, -40, 60, 36, 7).fill(0xd9a066).stroke({ width: 2.5, color: PALETTE.ink })
      g.moveTo(-24, -28).lineTo(24, -28).stroke({ width: 1.5, color: 0xb57d45 })
      g.star(-17, -16, 5, 5.5, 2.5).fill(PALETTE.star).stroke({ width: 1.5, color: PALETTE.ink })
      const text = new Text({
        text: String(this.best),
        style: { fontFamily: GAME_FONT, fontSize: 17, fontWeight: '700', fill: PALETTE.ink },
        resolution: 2,
      })
      text.anchor.set(0.5)
      text.position.set(5, -16)
      c.addChild(g, text)
      c.position.set(W - 44, padY + 6)
      c.rotation = 0.06
      this.scenery.addChild(c)
      this.signText = text
    }
  }

  private buildCritters(W: number, waterY: number) {
    const duck = new Container()
    drawDuck(duck)
    duck.position.set(W * 0.3, waterY + 16)
    this.scenery.addChild(duck)

    // The turtle sits on the far right pad, the frog on the far left one.
    const right = this.smallPads[1]
    const left = this.smallPads[0]
    const turtle = new Container()
    const turtleHead = new Graphics()
    drawTurtle(turtle, turtleHead)
    turtle.position.set(0, -6)
    right.c.addChild(turtle)

    const frog = new Container()
    const frogThroat = new Graphics()
    drawFarFrog(frog, frogThroat)
    frog.position.set(2, -4)
    left.c.addChild(frog)

    this.critters = {
      duck,
      duckX: W * 0.3,
      duckDir: 1,
      duckHop: 0,
      turtle,
      turtleHead,
      turtleOut: 1,
      turtleHide: 0,
      frog,
      frogThroat,
      croak: 0,
    }
  }

  private updateCritters(dt: number) {
    const c = this.critters
    if (!c) return
    const { worldW: W, waterY } = this.layout
    const t = this.time

    c.duckX += c.duckDir * 9 * dt
    if (c.duckX > W - 70) c.duckDir = -1
    if (c.duckX < 90) c.duckDir = 1
    c.duckHop = Math.max(0, c.duckHop - dt * 2.2)
    const hop = Math.sin(c.duckHop * Math.PI) * 16
    c.duck.position.set(c.duckX, waterY + 16 + Math.sin(t * 1.6) * 1.2 - hop)
    c.duck.scale.x = c.duckDir
    c.duck.rotation = c.duckHop > 0 ? Math.sin(t * 30) * 0.12 : Math.sin(t * 1.3) * 0.04

    // The turtle pokes its head out now and then, and hides after a fright.
    if (c.turtleHide > 0) c.turtleHide -= dt
    const out = c.turtleHide > 0 ? 0 : 0.75 + 0.25 * Math.sin(t * 0.7)
    c.turtleOut = damp(c.turtleOut, out, c.turtleHide > 0 ? 18 : 3, dt)
    c.turtleHead.x = -14 + 8 * c.turtleOut
    c.turtleHead.scale.set(0.4 + 0.6 * c.turtleOut)

    if (c.croak > 0) c.croak -= dt
    const puff = c.croak > 0 ? Math.max(0, Math.sin((1.2 - c.croak) * Math.PI * 3.3)) : 0
    c.frogThroat.scale.set(0.3 + puff * 0.9)
    c.frog.scale.y = 1 - puff * 0.05
  }

  private buildSun(W: number) {
    const s = this.sun
    const glow = new Graphics()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU
      glow
        .moveTo(Math.cos(a - 0.09) * 46, Math.sin(a - 0.09) * 46)
        .lineTo(Math.cos(a) * 78, Math.sin(a) * 78)
        .lineTo(Math.cos(a + 0.09) * 46, Math.sin(a + 0.09) * 46)
        .closePath()
    }
    glow.fill({ color: PALETTE.sunGlow, alpha: 0.35 })
    glow.circle(0, 0, 56).fill({ color: PALETTE.sunGlow, alpha: 0.3 })
    glow.circle(0, 0, 44).fill({ color: PALETTE.sunGlow, alpha: 0.5 })
    glow.circle(0, 0, 34).fill(PALETTE.sun)
    s.addChild(glow)
    this.sunY = 196
    s.position.set(W - 64, this.sunY)
    this.sky.addChild(s)
  }

  private buildClouds(W: number, waterY: number) {
    const specs = [
      { x: 0.12, y: 168, w: 120, speed: 7 },
      { x: 0.68, y: 252, w: 92, speed: 10 },
      { x: 0.35, y: 330, w: 150, speed: 5 },
      { x: 0.9, y: 420, w: 80, speed: 12 },
    ]
    for (const spec of specs) {
      if (spec.y > waterY - 160) continue
      const g = new Graphics()
      drawCloud(g, spec.w, PALETTE.cloudShade, 6)
      drawCloud(g, spec.w, PALETTE.cloud, 0)
      g.position.set(spec.x * W, spec.y)
      g.alpha = 0.95
      this.sky.addChild(g)
      this.clouds.push({ g, speed: spec.speed, span: spec.w })
    }
  }

  private drawHills(W: number, waterY: number) {
    const g = new Graphics()
    const ridge = (base: number, amp: number, f1: number, f2: number, phase: number) => {
      const pts: number[] = [-BLEED, waterY + 10]
      for (let x = -BLEED; x <= W + BLEED; x += 16) {
        const y =
          base - amp * (0.6 + 0.4 * Math.sin(x * f1 + phase)) - amp * 0.35 * Math.sin(x * f2)
        pts.push(x, y)
      }
      pts.push(W + BLEED, waterY + 10)
      return pts
    }
    g.poly(ridge(waterY - 34, 42, 0.011, 0.033, 0.8)).fill(PALETTE.hillFar)
    g.poly(ridge(waterY - 6, 28, 0.017, 0.041, 2.1)).fill(PALETTE.hillNear)
    // Round bushes along the near shore.
    const bushes = [-30, 34, 70, 290, 336, 380, 430]
    for (const bx of bushes) {
      const r = 14 + ((bx * 7) % 9)
      g.circle(bx, waterY - 8, r + 4).fill(PALETTE.bushDark)
      g.circle(bx - 6, waterY - 12, r).fill(PALETTE.bush)
    }
    return g
  }

  private drawWater(W: number, H: number, waterY: number) {
    const g = new Graphics()
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: PALETTE.waterTop },
        { offset: 1, color: PALETTE.waterBottom },
      ],
      textureSpace: 'local',
    })
    g.rect(-BLEED, waterY, W + BLEED * 2, H - waterY + BLEED).fill(gradient)
    g.rect(-BLEED, waterY - 1, W + BLEED * 2, 4).fill({ color: PALETTE.waterLine, alpha: 0.85 })
    return g
  }

  private buildGlints(W: number, H: number, waterY: number) {
    for (let i = 0; i < 11; i++) {
      const g = new Graphics()
      const w = this.rng.range(14, 38)
      g.roundRect(-w / 2, -1.5, w, 3, 1.5).fill(PALETTE.white)
      const x = this.rng.range(10, W - 10)
      g.position.set(x, this.rng.range(waterY + 16, H - 20))
      this.scenery.addChild(g)
      this.glints.push({ g, x, phase: this.rng.range(0, TAU) })
    }
  }

  private buildSmallPads(W: number, waterY: number, padY: number) {
    const specs = [
      { x: 52, y: waterY + 30, rx: 26 },
      { x: W - 40, y: waterY + 58, rx: 32 },
      { x: W - 92, y: padY + 70, rx: 22 },
    ]
    for (const s of specs) {
      const c = new Container()
      const g = new Graphics()
      drawPadShape(g, s.rx, s.rx * 0.3, 0.7)
      g.fill(PALETTE.padDark)
      drawPadShape(g, s.rx * 0.85, s.rx * 0.22, 0.7, -2)
      g.fill(PALETTE.pad)
      c.addChild(g)
      c.position.set(s.x, s.y)
      this.scenery.addChild(c)
      this.smallPads.push({ c, y: s.y })
    }
  }

  private buildRipples() {
    for (let i = 0; i < 8; i++) {
      const g = new Graphics()
      g.visible = false
      this.scenery.addChild(g)
      this.ripples.push({ g, x: 0, y: 0, t: 0, strength: 1, active: false })
    }
  }

  private buildMainPad(W: number, padY: number) {
    const p = this.pad
    const shadow = new Graphics()
    shadow.ellipse(0, 10, 118, 30).fill({ color: 0x1e5a6a, alpha: 0.25 })
    const g = new Graphics()
    drawPadShape(g, 116, 33, 0.55)
    g.fill(PALETTE.padDark).stroke({ width: 3, color: PALETTE.ink, join: 'round' })
    drawPadShape(g, 104, 26, 0.55, -3)
    g.fill(PALETTE.pad)
    // Veins.
    for (const a of [-2.6, -2.05, -1.5, -0.95, -0.4, 0.15, 2.3, 2.85]) {
      g.moveTo(0, -3).lineTo(Math.cos(a) * 92, -3 + Math.sin(a) * 22)
    }
    g.stroke({ width: 2, color: PALETTE.padDark, alpha: 0.7, cap: 'round' })
    g.ellipse(-30, -10, 34, 8).fill({ color: PALETTE.padLight, alpha: 0.55 })
    p.addChild(shadow, g)
    p.position.set(W / 2, padY)
    this.scenery.addChild(p)
  }

  private buildLily(padY: number) {
    const c = this.lily
    const g = new Graphics()
    g.ellipse(0, 6, 30, 8).fill({ color: PALETTE.padDark })
    const petal = (angle: number, len: number, color: number) => {
      const cx = Math.cos(angle) * len * 0.5
      const cy = Math.sin(angle) * len * 0.22
      g.ellipse(cx, cy - 6, len * 0.42, 9)
      g.fill(color)
    }
    for (let i = 0; i < 6; i++) petal(Math.PI + (i / 5) * Math.PI, 30, PALETTE.lilyPetalDeep)
    for (let i = 0; i < 5; i++)
      petal(Math.PI * 1.1 + (i / 4) * Math.PI * 0.8, 24, PALETTE.lilyPetal)
    g.circle(0, -8, 6).fill(PALETTE.lilyCenter)
    c.addChild(g)
    c.position.set(46, padY + 34)
    this.scenery.addChild(c)
  }

  private buildMotes(W: number, waterY: number) {
    for (let i = 0; i < 10; i++) {
      const g = new Graphics()
      g.circle(0, 0, this.rng.range(1.2, 2.4)).fill(PALETTE.white)
      const m = { g, x: this.rng.range(0, W), y: this.rng.range(150, waterY - 20), seed: i * 13.7 }
      this.scenery.addChild(g)
      this.motes.push(m)
    }
  }

  private buildReeds(parent: Container, W: number, baseY: number, foreground: boolean) {
    const clusters = foreground
      ? [
          { x: -14, count: 3, h: [150, 210] as const },
          { x: W + 12, count: 3, h: [130, 190] as const },
        ]
      : [
          { x: 18, count: 5, h: [70, 120] as const },
          { x: W - 22, count: 5, h: [64, 110] as const },
        ]
    for (const cl of clusters) {
      for (let i = 0; i < cl.count; i++) {
        const g = new Graphics()
        const h = this.rng.range(cl.h[0], cl.h[1])
        const w = foreground ? this.rng.range(13, 18) : this.rng.range(7, 10)
        const curve = this.rng.range(-18, 18)
        const color = foreground
          ? i % 2
            ? PALETTE.reedDark
            : PALETTE.reed
          : i % 2
            ? PALETTE.bush
            : PALETTE.reed
        const withCattail = this.rng.chance(foreground ? 0.4 : 0.35)
        if (withCattail) {
          g.moveTo(-2, 0)
            .quadraticCurveTo(curve * 0.4, -h * 0.5, curve * 0.6, -h * 1.05)
            .lineTo(curve * 0.6 + 3, -h * 1.05)
            .quadraticCurveTo(curve * 0.4 + 3, -h * 0.5, 2, 0)
            .closePath()
            .fill(PALETTE.reedDark)
          const cw = foreground ? 14 : 9
          g.roundRect(curve * 0.6 - cw / 2 + 1.5, -h * 0.98, cw, h * 0.26, cw / 2).fill(
            PALETTE.cattail,
          )
        } else {
          g.moveTo(-w / 2, 0)
            .quadraticCurveTo(-w / 2 + curve * 0.4, -h * 0.55, curve, -h)
            .quadraticCurveTo(w / 2 + curve * 0.4, -h * 0.55, w / 2, 0)
            .closePath()
            .fill(color)
        }
        const spread = foreground ? 26 : 16
        g.position.set(cl.x + (i - cl.count / 2) * spread * (cl.x < W / 2 ? 1 : -1), baseY + 6)
        parent.addChild(g)
        this.reeds.push({
          g,
          phase: this.rng.range(0, TAU),
          amp: this.rng.range(0.05, 0.1),
          speed: this.rng.range(0.9, 1.5),
        })
      }
    }
  }
}

function drawCloud(g: Graphics, w: number, color: number, dy: number) {
  const h = w * 0.34
  g.roundRect(-w / 2, -h * 0.25 + dy, w, h * 0.62, h * 0.31)
  g.circle(-w * 0.24, -h * 0.12 + dy, h * 0.42)
  g.circle(-w * 0.02, -h * 0.38 + dy, h * 0.55)
  g.circle(w * 0.24, -h * 0.18 + dy, h * 0.44)
  g.fill(color)
}

/** Lily pad ellipse with a wedge notch cut towards the front. */
function drawPadShape(g: Graphics, rx: number, ry: number, notch: number, dy = 0) {
  const notchAt = Math.PI / 2 + notch
  const gap = 0.2
  const steps = 40
  g.moveTo(0, dy)
  for (let i = 0; i <= steps; i++) {
    const a = notchAt + gap + (i / steps) * (TAU - gap * 2)
    g.lineTo(Math.cos(a) * rx, dy + Math.sin(a) * ry)
  }
  g.closePath()
}

/** Soft round blob for fog banks. */
function softTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
  g.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return Texture.from(canvas)
}

/** A small duck on the far water, facing right. */
function drawDuck(c: Container) {
  const ink = PALETTE.ink
  const g = new Graphics()
  g.ellipse(0, 0, 13, 7).fill(PALETTE.white).stroke({ width: 2, color: ink })
  g.poly([-11, -3, -18, -8, -13, 1])
    .fill(PALETTE.white)
    .stroke({ width: 2, color: ink, join: 'round' })
  g.ellipse(-2, -1, 6, 3).fill(0xe8eef2)
  g.circle(9, -9, 5.5).fill(PALETTE.white).stroke({ width: 2, color: ink })
  g.poly([13, -10, 20, -8, 13, -6]).fill(0xffa53d).stroke({ width: 1.5, color: ink, join: 'round' })
  g.circle(10.5, -10.5, 1.3).fill(ink)
  c.addChild(g)
}

/** A turtle on a lily pad. Its head slides in and out of the shell. */
function drawTurtle(c: Container, head: Graphics) {
  const ink = PALETTE.ink
  head.circle(0, 0, 4.5).fill(0x9ccf6a).stroke({ width: 1.6, color: ink })
  head.circle(1.5, -1, 1).fill(ink)
  head.position.set(-6, -3)
  const shell = new Graphics()
  shell.ellipse(0, 2, 13, 3.5).fill(0x7cb055).stroke({ width: 1.6, color: ink })
  shell.moveTo(-12, 1).quadraticCurveTo(0, -16, 12, 1).closePath().fill(0x7a8f3e).stroke({
    width: 1.8,
    color: ink,
    join: 'round',
  })
  shell.moveTo(-6, -1).lineTo(-3, -7).lineTo(3, -7).lineTo(6, -1).stroke({
    width: 1.3,
    color: 0x55692a,
    join: 'round',
  })
  c.addChild(head, shell)
}

/** A tiny frog on a far pad, with a throat sac that puffs out when it croaks. */
function drawFarFrog(c: Container, throat: Graphics) {
  const ink = PALETTE.ink
  throat.circle(0, 0, 4).fill(0xffd6e0).stroke({ width: 1.2, color: ink })
  throat.position.set(0, -3)
  const g = new Graphics()
  g.ellipse(0, -5, 9, 6).fill(PALETTE.bodyShade).stroke({ width: 1.6, color: ink })
  g.circle(-4.5, -11, 3.2).fill(PALETTE.bodyShade).stroke({ width: 1.4, color: ink })
  g.circle(4.5, -11, 3.2).fill(PALETTE.bodyShade).stroke({ width: 1.4, color: ink })
  g.circle(-4.5, -11.5, 1.3).fill(ink)
  g.circle(4.5, -11.5, 1.3).fill(ink)
  c.addChild(g, throat)
}
