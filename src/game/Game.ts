import { Application, Container, type Ticker } from 'pixi.js'
import { TAU, clamp, sweptHit } from '../lib/math'
import { Rng } from '../lib/random'
import { Pond } from './background/Pond'
import { StepClock } from './clock'
import { CONFIG } from './config'
import { PALETTE } from './draw/palette'
import { Emitter } from './emitter'
import type { Insect, Zone } from './entities/Insect'
import { Pofik } from './entities/Pofik'
import { Swarm, type SpawnRules } from './entities/Swarm'
import { Tongue, type TongueRoot } from './entities/Tongue'
import { DebugOverlay } from './fx/DebugOverlay'
import { FloatingText } from './fx/FloatingText'
import { Hints, type HintKind } from './fx/Hints'
import { Particles } from './fx/Particles'
import { ScreenShake } from './fx/ScreenShake'
import { Vignette } from './fx/Vignette'
import { computeLayout, toWorld, type Layout } from './layout'
import * as rules from './rules'

export type GameMode = 'attract' | 'playing' | 'paused' | 'dying' | 'over'
export type DeathCause = 'starved' | 'stung'

export interface GameEvents {
  caught: { count: number; score: number }
  stung: { hunger: number }
  runOver: { score: number; cause: DeathCause; canContinue: boolean }
}

export interface SoundSink {
  shoot(): void
  retract(): void
  stick(index: number): void
  gulp(count: number): void
  boop(): void
  sting(): void
  growl(): void
  gameOver(): void
  revive(): void
  start(): void
}

export interface BuzzSource {
  /** -1 (left) to 1 (right). */
  pan: number
  /** 0 (far) to 1 (right next to Pofik). */
  proximity: number
  speed: number
}

export interface BuzzSink {
  update(fly: BuzzSource | null, bee: BuzzSource | null): void
  silence(): void
}

export interface HapticsSink {
  light(): void
  sting(): void
  heavy(): void
}

export interface GameOptions {
  sound: SoundSink
  buzz: BuzzSink
  haptics: HapticsSink
  /** Receives HUD values; called only when something changed. */
  hud: (hunger01: number, score: number, critical: boolean) => void
  hints: { isDone(kind: HintKind): boolean; markDone(kind: HintKind): void }
  reducedMotion: boolean
  debug: boolean
  timeScale: number
  seed: number
}

const ATTRACT_RULES: SpawnRules = {
  flyInterval: CONFIG.attract.flyInterval,
  maxFlies: CONFIG.attract.maxFlies,
  beeInterval: 99,
  maxBees: 0,
  beesActive: false,
  flySpeed: 75,
  beeSpeed: 0,
}

/**
 * Owns the Pixi app, the simulation loop and the run state. React talks to it
 * through commands (startRun, pause, ...) and listens to {@link GameEvents}.
 */
export class Game {
  readonly events = new Emitter<GameEvents>()
  mode: GameMode = 'attract'

  private readonly app: Application
  private readonly opts: GameOptions
  private readonly rng: Rng
  private readonly clock = new StepClock()
  private readonly root = new Container()
  private readonly camera = new Container()
  private readonly pond = new Pond()
  private readonly pofik = new Pofik()
  private readonly tongue = new Tongue()
  private readonly swarm: Swarm
  private readonly particles: Particles
  private readonly floaters = new FloatingText()
  private readonly shake = new ScreenShake()
  private readonly vignette = new Vignette()
  private readonly hints = new Hints()
  private readonly debug: DebugOverlay | null
  private readonly resizeObserver: ResizeObserver

  private layout!: Layout
  private zone!: Zone
  private time = 0
  private runTime = 0
  private hunger: number = CONFIG.hunger.start
  private score = 0
  private stun = 0
  private invulnerable = 0
  private continued = false
  private dyingTimer = 0
  private slumpDelay = 0
  private deathCause: DeathCause = 'starved'
  private growlTimer = 0
  private autoShotTimer = 2
  private beeHintTime = 0
  private stickCount = 0
  private pendingTap: { x: number; y: number; t: number } | null = null
  /** Where the tongue starts: the resting tongue in Pofik's mouth. */
  private readonly mouth: TongueRoot = { x: 0, y: 0, rx: 1, ry: 1, rot: 0 }
  private hudLast = { h: -1, s: -1, c: false }
  private destroyed = false

  static async create(host: HTMLElement, opts: GameOptions) {
    const app = new Application()
    await app.init({
      preference: 'webgl',
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: PALETTE.skyBottom,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      powerPreference: 'high-performance',
    })
    return new Game(app, host, opts)
  }

  private constructor(app: Application, host: HTMLElement, opts: GameOptions) {
    this.app = app
    this.opts = opts
    this.rng = new Rng(opts.seed)
    this.swarm = new Swarm(this.rng)
    this.particles = new Particles(app.renderer, this.rng)
    this.clock.timeScale = opts.timeScale
    this.shake.intensity = opts.reducedMotion ? CONFIG.fx.reducedMotionShake : 1

    this.camera.addChild(
      this.pond.back,
      this.pofik.view,
      this.tongue.view,
      this.swarm.layer,
      this.pond.front,
      this.particles.layer,
      this.floaters.layer,
      this.hints.view,
    )
    this.root.addChild(this.camera)
    app.stage.addChild(this.root, this.vignette.sprite)

    this.debug = opts.debug ? new DebugOverlay() : null
    if (this.debug) {
      this.camera.addChild(this.debug.world)
      app.stage.addChild(this.debug.screen)
    }

    const canvas = app.canvas
    canvas.classList.add('game-canvas')
    host.appendChild(canvas)
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false })

    this.resize(host.clientWidth, host.clientHeight)
    this.resizeObserver = new ResizeObserver(() => this.resize(host.clientWidth, host.clientHeight))
    this.resizeObserver.observe(host)

    this.pofik.tongueRoot(this.mouth)
    app.ticker.add(this.frame)
  }

  // Commands ------------------------------------------------------------------

  startRun() {
    this.mode = 'playing'
    this.runTime = 0
    this.hunger = CONFIG.hunger.start
    this.score = 0
    this.stun = 0
    this.invulnerable = 0
    this.continued = false
    this.growlTimer = 0
    this.beeHintTime = 0
    this.pendingTap = null
    this.tongue.scored = false
    this.swarm.scatter(this.zone, 'bee')
    this.swarm.reset(CONFIG.spawn.firstFly)
    this.pofik.revive()
    this.pond.ripple(this.layout.worldW / 2, this.layout.padY + 6, 1)
    this.opts.sound.start()
    this.clock.reset()
    this.ensureRunning()
    this.pushHud(true)
  }

  pause() {
    if (this.mode !== 'playing') return
    this.mode = 'paused'
    this.pendingTap = null
    this.opts.buzz.silence()
    this.app.ticker.stop()
    this.app.render()
  }

  resume() {
    if (this.mode !== 'paused') return
    this.mode = 'playing'
    this.ensureRunning()
  }

  continueRun() {
    if (this.mode !== 'over' || this.continued) return
    this.continued = true
    this.mode = 'playing'
    this.hunger = rules.revive(this.hunger)
    this.stun = 0
    this.invulnerable = CONFIG.invulnerableAfterContinue
    this.pofik.revive()
    this.pofik.setInvulnerable(this.invulnerable)
    this.swarm.scatter(this.zone, 'bee')
    this.opts.sound.revive()
    this.particles.burst({
      x: this.mouth.x,
      y: this.mouth.y - 40,
      count: 18,
      shape: 'star',
      colors: [PALETTE.star, PALETTE.white, PALETTE.bodyLight],
      speed: [140, 320],
      life: [0.4, 0.8],
      size: [8, 16],
      gravity: 300,
      drag: 2.5,
      spin: 6,
    })
    this.ensureRunning()
    this.pushHud(true)
  }

  toTitle() {
    this.mode = 'attract'
    this.stun = 0
    this.invulnerable = 0
    this.pendingTap = null
    this.autoShotTimer = 2
    this.swarm.scatter(this.zone, 'bee')
    if (this.pofik.isDead) this.pofik.revive()
    this.vignette.setDanger(0)
    this.hints.hide()
    this.ensureRunning()
    this.pushHud(true)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.resizeObserver.disconnect()
    this.app.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.app.ticker.remove(this.frame)
    this.events.clear()
    this.opts.buzz.silence()
    this.app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
  }

  /** Read-only view of the run, for debugging and automated checks. */
  snapshot() {
    return {
      mode: this.mode,
      hunger: this.hunger,
      score: this.score,
      stun: this.stun,
      tongue: this.tongue.state,
      layout: this.layout,
      insects: this.swarm.list.map((it) => ({
        kind: it.kind,
        state: it.state,
        x: it.x,
        y: it.y,
      })),
    }
  }

  /** CSS-pixel position of a world point, relative to the canvas. */
  worldToCanvas(x: number, y: number) {
    return {
      x: this.layout.offsetX + x * this.layout.scale,
      y: this.layout.offsetY + y * this.layout.scale,
    }
  }

  // Loop ----------------------------------------------------------------------

  private ensureRunning() {
    if (!this.app.ticker.started) this.app.ticker.start()
  }

  private resize(width: number, height: number) {
    if (this.destroyed || width < 1 || height < 1) return
    this.app.renderer.resize(width, height)
    const prevH = this.layout?.worldH
    this.layout = computeLayout(width, height)
    const { worldW: W, worldH: H, scale, offsetX, offsetY } = this.layout
    this.root.scale.set(scale)
    this.root.position.set(offsetX, offsetY)
    this.camera.pivot.set(W / 2, H / 2)
    this.camera.position.set(W / 2, H / 2)
    if (prevH !== H) this.pond.build(this.layout)
    this.zone = {
      left: 26,
      right: W - 26,
      top: this.layout.flyTop,
      bottom: this.layout.flyBottom,
      worldW: W,
      worldH: H,
    }
    this.vignette.resize(width, height)
    this.pofik.setSeat(W / 2, this.layout.padY - 6 + this.pond.padBob)
    if (!this.app.ticker.started) this.renderFrame(0)
  }

  private frame = (ticker: Ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1)
    if (this.mode !== 'paused') this.clock.advance(dt, this.step)
    this.renderFrame(dt)
  }

  private renderFrame(dt: number) {
    const { worldW: W, worldH: H } = this.layout
    this.shake.update(dt)
    this.camera.position.set(W / 2 + this.shake.x, H / 2 + this.shake.y)
    this.camera.rotation = this.shake.angle
    this.vignette.update(dt)
    this.pofik.render()
    this.pofik.tongueRoot(this.mouth)
    this.tongue.render(this.mouth)
    this.swarm.sync()
    this.updateBuzz()
    this.pushHud(false)
    if (this.debug) this.updateDebug(dt)
    if (!this.app.ticker.started) this.app.render()
  }

  private step = (dt: number) => {
    this.time += dt
    this.pond.update(dt)
    this.pofik.setSeat(this.layout.worldW / 2, this.layout.padY - 6 + this.pond.padBob)

    if (this.mode === 'playing') this.runStep(dt)
    else if (this.mode === 'attract') this.attractStep(dt)
    else if (this.mode === 'dying') this.dyingStep(dt)

    this.pofik.tongueRoot(this.mouth)
    this.processInput()
    const home = this.tongue.update(dt, this.mouth.x, this.mouth.y)
    this.checkHits()
    for (const it of this.tongue.attached) it.followTip(this.tongue.tipX, this.tongue.tipY)
    if (home) this.onTongueHome()

    this.swarm.update(dt, this.zone)
    this.updateLook()
    this.pofik.update(dt)
    this.particles.update(dt)
    this.floaters.update(dt)
    this.hints.update(dt, this.layout.worldW, this.layout.flyTop)
  }

  private runStep(dt: number) {
    this.runTime += dt
    if (this.stun > 0) this.stun -= dt
    if (this.invulnerable > 0) this.invulnerable -= dt

    this.hunger = rules.drainHunger(this.hunger, dt, this.runTime)
    this.pofik.setHunger(this.hunger / CONFIG.hunger.max)
    if (rules.isStarved(this.hunger)) {
      this.die('starved')
      return
    }

    const critical = rules.isCritical(this.hunger)
    if (critical) {
      this.growlTimer -= dt
      if (this.growlTimer <= 0) {
        this.growlTimer = 3.2
        this.opts.sound.growl()
        this.pofik.growl()
      }
      const limit = CONFIG.hunger.max * CONFIG.hunger.critical
      this.vignette.setDanger(1 - this.hunger / limit)
    } else {
      this.growlTimer = 0.5
      this.vignette.setDanger(0)
    }

    this.swarm.spawnTick(dt, rules.difficulty(this.runTime), this.zone)
    this.updateHints(dt)
  }

  private attractStep(dt: number) {
    this.pofik.setHunger(1)
    this.vignette.setDanger(0)
    this.swarm.spawnTick(dt, ATTRACT_RULES, this.zone)
    this.autoShotTimer -= dt
    if (this.autoShotTimer <= 0 && !this.tongue.busy) {
      this.autoShotTimer = this.rng.range(CONFIG.attract.autoShot[0], CONFIG.attract.autoShot[1])
      const fly = this.swarm.nearestFree('fly', this.mouth.x, this.mouth.y, this.zone)
      if (fly) {
        const aim = Tongue.aim(
          this.mouth.x,
          this.mouth.y,
          fly.x + fly.vx * 0.07,
          fly.y + fly.vy * 0.07,
          this.layout.flyTop - 40,
        )
        this.fire(aim.x, aim.y, false)
      }
    }
  }

  private dyingStep(dt: number) {
    if (this.slumpDelay > 0) {
      this.slumpDelay -= dt
      if (this.slumpDelay <= 0) this.pofik.slump()
    }
    this.dyingTimer -= dt
    if (this.dyingTimer <= 0) {
      this.mode = 'over'
      this.events.emit('runOver', {
        score: this.score,
        cause: this.deathCause,
        canContinue: !this.continued,
      })
    }
  }

  // Interaction ---------------------------------------------------------------

  private onPointerDown = (e: PointerEvent) => {
    if (e.cancelable) e.preventDefault()
    if (this.mode !== 'playing' && this.mode !== 'attract') return
    const rect = this.app.canvas.getBoundingClientRect()
    const p = toWorld(this.layout, e.clientX - rect.left, e.clientY - rect.top)
    if (this.pofik.containsPoint(p.x, p.y)) {
      if (this.stun > 0 || this.pofik.isDead) return
      this.pofik.boop()
      this.opts.sound.boop()
      this.opts.haptics.light()
      this.particles.burst({
        x: p.x,
        y: p.y - 10,
        count: 5,
        colors: [PALETTE.blush, PALETTE.white],
        speed: [60, 140],
        angle: [Math.PI + 0.5, TAU - 0.5],
        life: [0.35, 0.6],
        size: [6, 10],
        gravity: -60,
        drag: 3,
      })
      return
    }
    this.pendingTap = { x: p.x, y: p.y, t: this.time }
  }

  private processInput() {
    const tap = this.pendingTap
    if (!tap) return
    if (this.time - tap.t > CONFIG.tongue.inputBuffer) {
      this.pendingTap = null
      return
    }
    const canShoot =
      (this.mode === 'playing' || this.mode === 'attract') && this.stun <= 0 && !this.pofik.isDead
    if (!canShoot || this.tongue.busy) return
    this.pendingTap = null
    const aim = Tongue.aim(this.mouth.x, this.mouth.y, tap.x, tap.y, this.layout.flyTop - 40)
    this.fire(aim.x, aim.y, this.mode === 'playing')
  }

  private fire(tx: number, ty: number, scored: boolean) {
    this.tongue.fire(this.mouth.x, this.mouth.y, tx, ty, scored)
    const d = Math.hypot(tx - this.mouth.x, ty - this.mouth.y) || 1
    this.pofik.shoot((tx - this.mouth.x) / d)
    this.opts.sound.shoot()
    this.stickCount = 0
  }

  private checkHits() {
    const t = this.tongue
    if (!t.busy) return
    const r = CONFIG.tongue.tipRadius
    for (const it of this.swarm.list) {
      if (!it.free) continue
      if (!sweptHit(t.prevTipX, t.prevTipY, t.tipX, t.tipY, it.x, it.y, r + it.hitR)) continue
      if (it.kind === 'fly') this.onStick(it)
      else if (!t.stung && it.safeUntil <= this.time && this.invulnerable <= 0) this.onSting(it)
    }
  }

  private onStick(fly: Insect) {
    fly.catchOn(this.tongue.tipX, this.tongue.tipY, this.rng)
    this.tongue.attached.push(fly)
    this.stickCount++
    this.opts.sound.stick(this.stickCount)
    this.particles.burst({
      x: fly.x,
      y: fly.y,
      count: 7,
      colors: [PALETTE.white, PALETTE.puff, PALETTE.tongueLight],
      speed: [70, 180],
      life: [0.18, 0.34],
      size: [4, 8],
      drag: 6,
    })
    this.clock.hitStopFor(CONFIG.fx.hitStopCatch)
    this.shake.add(CONFIG.fx.catchTrauma)
  }

  private onSting(bee: Insect) {
    const t = this.tongue
    t.yank()
    bee.flee(t.tipX, t.tipY, this.time)
    this.particles.burst({
      x: t.tipX,
      y: t.tipY,
      count: 9,
      shape: 'star',
      colors: [PALETTE.star, 0xffa53d, PALETTE.white],
      speed: [160, 340],
      life: [0.3, 0.55],
      size: [10, 18],
      drag: 4,
      spin: 8,
    })
    this.particles.ring(t.tipX, t.tipY, PALETTE.sting, 12, 80, 0.35)
    this.floaters.show('Ouch!', t.tipX, t.tipY - 16, PALETTE.sting, 30)
    this.clock.hitStopFor(CONFIG.fx.hitStopSting)
    this.shake.add(CONFIG.fx.stingTrauma)
    this.vignette.flash()
    this.opts.sound.sting()
    this.opts.haptics.sting()
    this.pofik.sting(CONFIG.stun)
    this.opts.hints.markDone('avoidBee')

    if (this.mode !== 'playing') return
    this.hunger = rules.sting(this.hunger)
    this.stun = CONFIG.stun
    this.pendingTap = null
    this.events.emit('stung', { hunger: this.hunger })
    if (rules.isStarved(this.hunger)) this.die('stung')
  }

  private onTongueHome() {
    const t = this.tongue
    const n = t.attached.length
    this.pofik.tongueHome()
    if (n === 0) {
      this.opts.sound.retract()
      return
    }
    for (const it of t.attached) it.swallow()
    t.attached.length = 0

    this.pofik.gulp(n)
    this.opts.sound.gulp(n)
    this.opts.haptics.light()
    this.shake.add(CONFIG.fx.gulpTrauma)
    this.particles.burst({
      x: this.mouth.x,
      y: this.mouth.y,
      count: 10 + n * 3,
      colors: [PALETTE.puff, PALETTE.bodyLight, PALETTE.white],
      speed: [90, 230],
      angle: [Math.PI + 0.25, TAU - 0.25],
      life: [0.28, 0.5],
      size: [5, 10],
      gravity: 520,
      drag: 3,
    })
    this.particles.ring(this.mouth.x, this.mouth.y, PALETTE.white, 14, 66, 0.32, 0.8)
    this.pond.ripple(this.layout.worldW / 2, this.layout.padY + 8, 0.9)

    if (!t.scored || this.mode !== 'playing') return
    this.score += n
    this.hunger = rules.feed(this.hunger, n)
    this.floaters.show(`+${n}`, this.mouth.x, this.mouth.y - 112, PALETTE.white, n > 1 ? 40 : 34)
    this.opts.hints.markDone('tapFly')
    this.events.emit('caught', { count: n, score: this.score })
  }

  private die(cause: DeathCause) {
    this.mode = 'dying'
    this.deathCause = cause
    this.dyingTimer = CONFIG.dyingDuration
    this.slumpDelay = cause === 'stung' ? 0.45 : 0
    this.hunger = 0
    this.pendingTap = null
    if (cause === 'starved') this.pofik.slump()
    this.opts.sound.gameOver()
    this.opts.haptics.heavy()
    this.swarm.scatter(this.zone)
    this.vignette.setDanger(0)
    this.hints.hide()
    this.pushHud(true)
  }

  // Per-frame helpers --------------------------------------------------------

  private updateLook() {
    if (this.tongue.busy) {
      this.pofik.lookAt(this.tongue.tipX, this.tongue.tipY)
      return
    }
    if (this.mode !== 'playing' && this.mode !== 'attract') {
      this.pofik.clearLook()
      return
    }
    const target =
      this.swarm.nearestFree('fly', this.mouth.x, this.mouth.y, this.zone) ??
      this.swarm.nearestFree('bee', this.mouth.x, this.mouth.y, this.zone)
    if (target) this.pofik.lookAt(target.x, target.y)
    else this.pofik.clearLook()
  }

  private updateHints(dt: number) {
    const { hints } = this.opts
    if (!hints.isDone('tapFly')) {
      const fly = this.swarm.nearestFree('fly', this.mouth.x, this.mouth.y, this.zone)
      if (fly && this.runTime > 0.6) this.hints.show('tapFly', fly)
      else this.hints.hide()
      return
    }
    if (!hints.isDone('avoidBee')) {
      const bee = this.swarm.nearestFree('bee', this.mouth.x, this.mouth.y, this.zone)
      if (bee) {
        this.hints.show('avoidBee', bee)
        this.beeHintTime += dt
        if (this.beeHintTime > 3.5) hints.markDone('avoidBee')
      } else this.hints.hide()
      return
    }
    this.hints.hide()
  }

  private updateBuzz() {
    if (this.mode === 'paused') return
    const source = (kind: 'fly' | 'bee') => {
      const it = this.swarm.nearestFree(kind, this.mouth.x, this.mouth.y)
      if (!it) return null
      const d = Math.hypot(it.x - this.mouth.x, it.y - this.mouth.y)
      const W = this.layout.worldW
      return {
        pan: clamp((it.x - W / 2) / (W / 2), -1, 1),
        proximity: clamp(1 - d / 560, 0, 1),
        speed: Math.hypot(it.vx, it.vy),
      }
    }
    this.opts.buzz.update(source('fly'), source('bee'))
  }

  private pushHud(force: boolean) {
    const h01 = this.hunger / CONFIG.hunger.max
    const critical = this.mode === 'playing' && rules.isCritical(this.hunger)
    const last = this.hudLast
    if (!force && Math.abs(h01 - last.h) < 0.0005 && this.score === last.s && critical === last.c)
      return
    last.h = h01
    last.s = this.score
    last.c = critical
    this.opts.hud(h01, this.score, critical)
  }

  private updateDebug(dt: number) {
    const t = this.tongue
    this.debug!.update(
      {
        fps: 0,
        mode: this.mode,
        hunger: this.hunger,
        score: this.score,
        insects: this.swarm.list.map((it) => ({
          x: it.x,
          y: it.y,
          r: it.hitR,
          bee: it.kind === 'bee',
          free: it.free,
        })),
        tip: t.busy ? { x: t.tipX, y: t.tipY, r: CONFIG.tongue.tipRadius } : null,
        zone: this.zone,
        boop: { x: this.layout.worldW / 2, y: this.layout.padY - 6 - 72, rx: 88, ry: 82 },
      },
      dt,
    )
  }
}
