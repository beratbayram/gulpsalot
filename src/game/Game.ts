import { Application, Container, type Ticker } from 'pixi.js'
import * as i18n from '../i18n'
import { TAU, clamp, sweptHit } from '../lib/math'
import { Rng } from '../lib/random'
import type { AchievementId } from './achievements'
import { Pond } from './background/Pond'
import { StepClock } from './clock'
import { CONFIG } from './config'
import type { Look } from './cosmetics'
import { PALETTE } from './draw/palette'
import { Emitter } from './emitter'
import type { Insect, Zone } from './entities/Insect'
import { Pofik } from './entities/Pofik'
import { Swarm, type InsectFilter } from './entities/Swarm'
import { Tongue, type TongueRoot } from './entities/Tongue'
import { DebugOverlay } from './fx/DebugOverlay'
import { FloatingText } from './fx/FloatingText'
import { Hints, type HintKind } from './fx/Hints'
import { Particles } from './fx/Particles'
import { ScreenShake } from './fx/ScreenShake'
import { Vignette } from './fx/Vignette'
import { computeLayout, toWorld, type Layout } from './layout'
import * as rules from './rules'
import type { Difficulty, PreyKind } from './rules'

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
  goldenAppear(pan: number): void
  twinkle(pan: number): void
  goldenCatch(): void
  catchSpecial(kind: 'dragonfly' | 'firefly'): void
  combo(level: number): void
  closeCall(): void
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

export interface HudFrame {
  /** 0..1 */
  hunger: number
  score: number
  critical: boolean
  /** Current combo multiplier, 1 when there is no combo. */
  combo: number
}

export interface GameOptions {
  sound: SoundSink
  buzz: BuzzSink
  haptics: HapticsSink
  /** Receives HUD values; called only when something changed. */
  hud: (frame: HudFrame) => void
  hints: { isDone(kind: HintKind): boolean; markDone(kind: HintKind): void }
  achievements: { has(id: AchievementId): boolean; unlock(id: AchievementId): void }
  reducedMotion: boolean
  debug: boolean
  timeScale: number
  /** Seed for every run (`?seed`), or null for a fresh one each time. */
  seed: number | null
  /** Run time every run starts at (`?time`), to test later stages quickly. */
  startTime: number
}

export interface RunOptions {
  /** Seeded runs spawn the same insects for every player (the daily challenge). */
  seed?: number
  canContinue?: boolean
}

const OFF = { active: false, interval: 99, max: 0, speed: 0 }

const ATTRACT_RULES: Difficulty = {
  fly: {
    active: true,
    interval: CONFIG.attract.flyInterval,
    max: CONFIG.attract.maxFlies,
    speed: 75,
  },
  bee: OFF,
  dragonfly: OFF,
  firefly: OFF,
  goldenChance: 0,
  goldenSpeed: 0,
}

/** Popup colors by combo multiplier. */
const COMBO_COLORS = [
  PALETTE.white,
  PALETTE.white,
  PALETTE.star,
  0xffa53d,
  PALETTE.tongue,
  0xb48cff,
]

/**
 * Owns the Pixi app, the simulation loop and the run state. React talks to it
 * through commands (startRun, pause, ...) and listens to {@link GameEvents}.
 */
export class Game {
  readonly events = new Emitter<GameEvents>()
  mode: GameMode = 'attract'

  private readonly app: Application
  private readonly opts: GameOptions
  /** Effects and attract mode. Never seeded, so it can't disturb seeded spawns. */
  private readonly fxRng = new Rng()
  /** Insect spawns only. Reseeded at the start of every run. */
  private readonly spawnRng = new Rng()
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
  private canContinue = true
  /** Insects caught in quick succession; drives the combo multiplier. */
  private chain = 0
  private comboTimer = 0
  /** Insects caught since the last miss or sting. */
  private streak = 0
  /** The current shot passed close to a bee without touching it. */
  private nearBee = false
  private boops = 0
  private lastBoop = -10
  private twinkleTimer = 0
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
  private hudLast = { h: -1, s: -1, c: false, m: 1 }
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
    this.swarm = new Swarm(this.spawnRng)
    this.swarm.onSpawn = this.onSpawn
    this.particles = new Particles(app.renderer, this.fxRng)
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

  startRun({ seed, canContinue = true }: RunOptions = {}) {
    this.mode = 'playing'
    this.spawnRng.reseed(seed ?? this.opts.seed ?? this.fxRng.int(1, 0x7fffffff))
    this.runTime = this.opts.startTime
    this.hunger = CONFIG.hunger.start
    this.score = 0
    this.stun = 0
    this.invulnerable = 0
    this.continued = false
    this.canContinue = canContinue
    this.streak = 0
    this.resetCombo()
    this.growlTimer = 0
    this.beeHintTime = 0
    this.pendingTap = null
    this.tongue.scored = false
    // A clean sky, so the insects that count are the same for everyone on a seeded run.
    this.swarm.scatter(this.zone)
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
    if (this.mode !== 'over' || this.continued || !this.canContinue) return
    this.continued = true
    this.mode = 'playing'
    this.hunger = rules.revive(this.hunger)
    this.stun = 0
    this.resetCombo()
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
    this.resetCombo()
    this.pendingTap = null
    this.autoShotTimer = 2
    this.swarm.scatter(this.zone, 'bee')
    if (this.pofik.isDead) this.pofik.revive()
    this.vignette.setDanger(0)
    this.hints.hide()
    this.ensureRunning()
    this.pushHud(true)
  }

  setLook(look: Look) {
    this.pofik.setLook(look)
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
      runTime: this.runTime,
      hunger: this.hunger,
      score: this.score,
      combo: rules.comboMultiplier(this.chain),
      streak: this.streak,
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
    const ambient = this.pond.ambient
    this.pofik.view.tint = ambient
    this.tongue.view.tint = ambient
    this.swarm.setAmbient(ambient)
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
    this.pond.setSky(this.mode === 'attract' ? 0 : rules.skyPhase(this.runTime))
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
    this.updateSparkles(dt)
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
    // The combo clock waits while the tongue is out, so a catch in flight still counts.
    if (this.comboTimer > 0 && !this.tongue.busy) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.chain = 0
    }
    if (this.runTime >= 120) this.achieve('survive2m')

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
      this.autoShotTimer = this.fxRng.range(CONFIG.attract.autoShot[0], CONFIG.attract.autoShot[1])
      const fly = this.swarm.nearestFree('prey', this.mouth.x, this.mouth.y, this.zone)
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
        canContinue: this.canContinue && !this.continued,
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
      this.boops = this.time - this.lastBoop < 1.2 ? this.boops + 1 : 1
      this.lastBoop = this.time
      if (this.boops >= 10) this.achieve('boop')
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
    this.nearBee = false
  }

  private checkHits() {
    const t = this.tongue
    if (!t.busy) return
    const r = CONFIG.tongue.tipRadius
    const hit = (it: Insect, reach: number) =>
      sweptHit(t.prevTipX, t.prevTipY, t.tipX, t.tipY, it.x, it.y, reach)
    for (const it of this.swarm.list) {
      if (!it.free) continue
      const reach = r + it.hitR
      if (it.isPrey) {
        if (hit(it, reach)) this.onStick(it)
        continue
      }
      const touching = hit(it, reach)
      if (touching && !t.stung && it.safeUntil <= this.time && this.invulnerable <= 0)
        this.onSting(it)
      else if (!touching && hit(it, reach + CONFIG.tongue.closeCall)) this.nearBee = true
    }
  }

  private onStick(fly: Insect) {
    fly.catchOn(this.tongue.tipX, this.tongue.tipY)
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
    if (fly.kind === 'golden') this.goldBurst(fly.x, fly.y, 10)
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
    this.floaters.show(i18n.t('game.ouch'), t.tipX, t.tipY - 16, PALETTE.sting, 30)
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
    this.resetCombo()
    this.streak = 0
    this.pendingTap = null
    this.events.emit('stung', { hunger: this.hunger })
    if (rules.isStarved(this.hunger)) this.die('stung')
  }

  private onTongueHome() {
    const t = this.tongue
    const n = t.attached.length
    const scored = t.scored && this.mode === 'playing'
    this.pofik.tongueHome()
    if (n === 0) {
      this.opts.sound.retract()
      // A miss ends the combo and the streak.
      if (scored) {
        this.resetCombo()
        this.streak = 0
      }
      return
    }
    const kinds: PreyKind[] = []
    for (const it of t.attached) {
      if (it.kind !== 'bee') kinds.push(it.kind)
      it.swallow()
    }
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

    if (scored) this.scoreCatch(kinds)
  }

  private scoreCatch(kinds: PreyKind[]) {
    const n = kinds.length
    const { points, food } = rules.preyValue(kinds)
    const before = rules.comboMultiplier(this.chain)
    this.chain += n
    this.comboTimer = CONFIG.combo.window
    const multiplier = rules.comboMultiplier(this.chain)
    const gained = points * multiplier
    this.score += gained
    this.hunger = rules.feed(this.hunger, food)
    this.streak += n

    const { x, y } = this.mouth
    const golden = kinds.includes('golden')
    const size = golden || gained >= 5 ? 44 : gained > 1 ? 40 : 34
    this.floaters.show(`+${gained}`, x, y - 112, golden ? PALETTE.gold : PALETTE.white, size)
    if (golden) {
      this.opts.sound.goldenCatch()
      this.goldBurst(x, y - 20, 22)
    } else if (kinds.includes('dragonfly')) this.opts.sound.catchSpecial('dragonfly')
    else if (kinds.includes('firefly')) this.opts.sound.catchSpecial('firefly')
    if (multiplier > before) this.onComboUp(multiplier)
    if (this.nearBee && !this.tongue.stung) this.onCloseCall()

    this.opts.hints.markDone('tapFly')
    this.events.emit('caught', { count: n, score: this.score })

    if (golden) this.achieve('golden')
    if (kinds.includes('dragonfly')) this.achieve('dragonfly')
    if (kinds.includes('firefly')) this.achieve('firefly')
    if (n >= 3) this.achieve('multi3')
    if (multiplier >= 5) this.achieve('combo5')
    if (this.streak >= 10) this.achieve('streak10')
    if (this.score >= 100) this.achieve('score100')
  }

  /** Bigger, brighter popups and a higher note for every combo level. */
  private onComboUp(multiplier: number) {
    const { x, y } = this.mouth
    const color = COMBO_COLORS[Math.min(multiplier, COMBO_COLORS.length - 1)]
    this.floaters.show(
      i18n.t('game.combo', { n: multiplier }),
      x,
      y - 162,
      color,
      24 + multiplier * 3,
    )
    this.particles.ring(x, y - 60, color, 20, 70 + multiplier * 18, 0.4)
    this.particles.burst({
      x,
      y: y - 150,
      count: 3 + multiplier * 3,
      shape: 'star',
      colors: [color, PALETTE.white],
      speed: [120, 180 + multiplier * 40],
      life: [0.35, 0.6],
      size: [7, 12],
      drag: 3,
      spin: 6,
    })
    this.shake.add(0.04 * multiplier)
    this.opts.sound.combo(multiplier)
    this.opts.haptics.light()
  }

  private onCloseCall() {
    this.floaters.show(i18n.t('game.closeCall'), this.mouth.x, this.mouth.y - 206, PALETTE.star, 28)
    this.opts.sound.closeCall()
    this.achieve('dodge')
  }

  private resetCombo() {
    this.chain = 0
    this.comboTimer = 0
  }

  private achieve(id: AchievementId) {
    if (!this.opts.achievements.has(id)) this.opts.achievements.unlock(id)
  }

  private onSpawn = (it: Insect) => {
    if (it.kind === 'golden' && this.mode === 'playing')
      this.opts.sound.goldenAppear(this.panOf(it.x))
  }

  private goldBurst(x: number, y: number, count: number) {
    this.particles.burst({
      x,
      y,
      count,
      shape: 'star',
      colors: [PALETTE.gold, PALETTE.goldLight, PALETTE.white],
      speed: [90, 260],
      life: [0.35, 0.7],
      size: [7, 14],
      gravity: 160,
      drag: 2.5,
      spin: 7,
    })
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
    this.resetCombo()
    this.swarm.scatter(this.zone)
    this.vignette.setDanger(0)
    this.hints.hide()
    this.pushHud(true)
  }

  // Per-frame helpers --------------------------------------------------------

  /** Golden flies leave a trail of sparkles and twinkle while they are around. */
  private updateSparkles(dt: number) {
    let twinkling: Insect | null = null
    for (const it of this.swarm.list) {
      if (it.kind !== 'golden' || !it.free) continue
      twinkling = it
      it.trailTimer -= dt
      if (it.trailTimer > 0) continue
      it.trailTimer = 0.05
      this.particles.burst({
        x: it.x - Math.sign(it.vx) * 8,
        y: it.y + 2,
        count: 1,
        shape: 'star',
        colors: [PALETTE.gold, PALETTE.goldLight, PALETTE.white],
        speed: [8, 36],
        life: [0.35, 0.65],
        size: [5, 9],
        gravity: 30,
        drag: 2,
        spin: 5,
      })
    }
    if (!twinkling || this.mode !== 'playing') return
    this.twinkleTimer -= dt
    if (this.twinkleTimer > 0) return
    this.twinkleTimer = this.fxRng.range(0.24, 0.42)
    this.opts.sound.twinkle(this.panOf(twinkling.x))
  }

  private panOf(x: number) {
    const W = this.layout.worldW
    return clamp((x - W / 2) / (W / 2), -1, 1)
  }

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
      this.swarm.nearestFree('prey', this.mouth.x, this.mouth.y, this.zone) ??
      this.swarm.nearestFree('bee', this.mouth.x, this.mouth.y, this.zone)
    if (target) this.pofik.lookAt(target.x, target.y)
    else this.pofik.clearLook()
  }

  private updateHints(dt: number) {
    const { hints } = this.opts
    if (!hints.isDone('tapFly')) {
      const fly = this.swarm.nearestFree('prey', this.mouth.x, this.mouth.y, this.zone)
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
    const source = (filter: InsectFilter) => {
      const it = this.swarm.nearestFree(filter, this.mouth.x, this.mouth.y)
      if (!it) return null
      const d = Math.hypot(it.x - this.mouth.x, it.y - this.mouth.y)
      return {
        pan: this.panOf(it.x),
        proximity: clamp(1 - d / 560, 0, 1),
        speed: Math.hypot(it.vx, it.vy),
      }
    }
    this.opts.buzz.update(source('prey'), source('bee'))
  }

  private pushHud(force: boolean) {
    const h01 = this.hunger / CONFIG.hunger.max
    const critical = this.mode === 'playing' && rules.isCritical(this.hunger)
    const combo = rules.comboMultiplier(this.chain)
    const last = this.hudLast
    const same =
      Math.abs(h01 - last.h) < 0.0005 &&
      this.score === last.s &&
      critical === last.c &&
      combo === last.m
    if (!force && same) return
    last.h = h01
    last.s = this.score
    last.c = critical
    last.m = combo
    this.opts.hud({ hunger: h01, score: this.score, critical, combo })
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
