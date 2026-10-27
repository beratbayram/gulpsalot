import { Application, Container, type Ticker } from 'pixi.js'
import * as i18n from '../i18n'
import { TAU, clamp, distSqPointSegment, mixColor, segmentsIntersect, sweptHit } from '../lib/math'
import { Rng } from '../lib/random'
import type { AchievementId } from './achievements'
import { Pond } from './background/Pond'
import { StepClock } from './clock'
import { CONFIG } from './config'
import type { DecorId, Look } from './cosmetics'
import { PALETTE } from './draw/palette'
import { Emitter } from './emitter'
import { Fish } from './entities/Fish'
import { Heron } from './entities/Heron'
import { POWER_COLORS, type Insect, type Zone } from './entities/Insect'
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
import { MODES, modeDifficulty, stingScore, type ModeRules, type PlayMode } from './modes'
import type { ProgressEvent, StingSource } from './progress'
import { fogAt, pickWeather, windAt, windSide, type Weather } from './weather'
import * as rules from './rules'
import type { Difficulty, HazardKind, PowerKind, PreyKind, SetState } from './rules'

export type GameMode = 'attract' | 'playing' | 'paused' | 'dying' | 'over'
export type DeathCause = 'starved' | 'stung' | 'wasp' | 'spider' | 'heron' | 'time' | 'missed'

export interface GameEvents {
  caught: { count: number; score: number }
  stung: { hunger: number }
  runOver: {
    score: number
    cause: DeathCause
    canContinue: boolean
    /** The run's spawn seed, for challenge links. */
    seed: number
    bestCombo: number
    stings: number
  }
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
  catchSpecial(kind: 'dragonfly' | 'firefly' | 'moth'): void
  combo(level: number): void
  closeCall(): void
  /** A spider bites the tongue. */
  bite(): void
  /** The tongue snags on spider silk. */
  snag(): void
  /** Pofik swallowed a bitter ladybug. */
  yuck(): void
  fishLeap(pan: number): void
  splash(pan: number): void
  heronCall(): void
  peck(): void
  /** A power-up beetle was eaten. */
  powerUp(kind: PowerKind): void
  powerEnd(): void
  burp(): void
  /** Three of a kind in a row. */
  set(): void
  bullseye(): void
  /** Rush mode: the clock ran out. */
  timeUp(): void
  /** Sharpshooter: a miss cost a heart. */
  heartLost(): void
  /** The duck on the far water gets a fright. */
  quack(pan: number): void
  /** The far frog croaks along with a big combo. */
  croak(pan: number): void
  /** Pofik yawns after a long time without a catch. */
  yawn(): void
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

/** Background music that follows the run. */
export interface MusicSink {
  setMood(mood: 'title' | 'run' | 'zen' | 'over' | 'paused'): void
  /** Combo multiplier, 1 to 5: more layers join as it climbs. */
  setIntensity(level: number): void
  /** 0 = day, 1 = night. */
  setNight(amount: number): void
}

/** Weather sounds: rain and wind loops. */
export interface AmbienceSink {
  /** `level` 0..1: how heavy the rain or how strong the gust is right now. */
  update(weather: Weather, level: number): void
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
  /** 0..1, how full the burp meter is. */
  burp: number
  /** The active power-up, if any, and how much of it is left (0..1). */
  power: PowerKind | null
  powerLeft: number
  /** Sharpshooter hearts left, 0 in other modes. */
  hearts: number
  /** Rush seconds left, 0 in other modes. */
  timeLeft: number
}

export interface GameOptions {
  sound: SoundSink
  buzz: BuzzSink
  ambience: AmbienceSink
  music: MusicSink
  haptics: HapticsSink
  /** Receives HUD values; called only when something changed. */
  hud: (frame: HudFrame) => void
  hints: { isDone(kind: HintKind): boolean; markDone(kind: HintKind): void }
  achievements: { has(id: AchievementId): boolean; unlock(id: AchievementId): void }
  /** Lifetime stats, missions and secret looks. */
  progress: { record(event: ProgressEvent): void }
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
  mode?: PlayMode
}

const OFF = { active: false, interval: 99, max: 0, speed: 0 }

const CAUSE: Record<HazardKind, DeathCause> = { bee: 'stung', wasp: 'wasp', spider: 'spider' }

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
  moth: OFF,
  ladybug: OFF,
  wasp: OFF,
  spider: OFF,
  beetle: OFF,
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
  /** Pond events (fish, heron). Seeded from the run seed but separate from spawns. */
  private readonly eventRng = new Rng()
  private readonly clock = new StepClock()
  private readonly root = new Container()
  private readonly camera = new Container()
  private readonly pond = new Pond()
  private readonly pofik = new Pofik()
  private readonly tongue = new Tongue()
  private readonly fish = new Fish()
  private readonly heron = new Heron()
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
  private fishTimer = 0
  private heronTimer = 0
  /** Shots left that launch slower after eating a ladybug. */
  private bitterShots = 0
  /** 0..1; overeating fills it and a full meter burps. */
  private burp = 0
  private power: PowerKind | null = null
  private powerTime = 0
  private frenzyTimer = 0
  private readonly sets: SetState = { kind: null, count: 0 }
  /** Bullseye hits on the current shot. */
  private bullseyes = 0
  private rules: ModeRules = MODES.classic
  private playMode: PlayMode = 'classic'
  private hearts = 0
  private timeLeft = 0
  private runStart = 0
  /** Seconds since the last catch, for Pofik's bored yawn. */
  private idleTime = 0
  private tickTimer = 0
  private runCatches = 0
  private runMisses = 0
  private runSeed = 0
  private runBestCombo = 1
  private runStings = 0
  private weather: Weather = 'clear'
  private windDir = 1
  private wind = 0
  private pendingTap: { x: number; y: number; t: number } | null = null
  /** Where the tongue starts: the resting tongue in Pofik's mouth. */
  private readonly mouth: TongueRoot = { x: 0, y: 0, rx: 1, ry: 1, rot: 0 }
  private hudLast: HudFrame = {
    hunger: -1,
    score: -1,
    critical: false,
    combo: 1,
    burp: -1,
    power: null,
    powerLeft: -1,
    hearts: -1,
    timeLeft: -1,
  }
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
    this.swarm = new Swarm()
    this.swarm.reseed(this.fxRng.int(1, 0x7fffffff))
    this.swarm.onSpawn = this.onSpawn
    this.particles = new Particles(app.renderer, this.fxRng)
    this.clock.timeScale = opts.timeScale
    this.shake.intensity = opts.reducedMotion ? CONFIG.fx.reducedMotionShake : 1

    this.camera.addChild(
      this.pond.back,
      this.fish.shadow,
      this.pofik.view,
      this.tongue.view,
      this.swarm.layer,
      this.fish.view,
      this.pond.front,
      this.pond.overlay,
      this.heron.view,
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

  startRun({ seed, canContinue = true, mode = 'classic' }: RunOptions = {}) {
    this.mode = 'playing'
    this.playMode = mode
    this.rules = MODES[mode]
    this.hearts = this.rules.hearts ?? 0
    this.timeLeft = this.rules.timeLimit ?? 0
    const runSeed = seed ?? this.opts.seed ?? this.fxRng.int(1, 0x7fffffff)
    this.runSeed = runSeed
    this.runBestCombo = 1
    this.runStings = 0
    this.swarm.reseed(runSeed)
    this.eventRng.reseed(runSeed ^ 0x2b7e1516)
    this.setWeather(pickWeather(runSeed))
    this.windDir = windSide(runSeed)
    this.fishTimer = CONFIG.fish.start + this.eventRng.range(...CONFIG.fish.interval) * 0.3
    this.heronTimer = CONFIG.heron.start + this.eventRng.range(0, 12)
    this.fish.cancel()
    this.heron.cancel()
    this.pofik.setHiding(false)
    this.bitterShots = 0
    this.burp = 0
    this.endPower(false)
    this.runTime = this.opts.startTime + this.rules.startTime
    this.runStart = this.runTime
    this.idleTime = 0
    this.tickTimer = 1
    this.runCatches = 0
    this.runMisses = 0
    this.hunger = CONFIG.hunger.start
    this.score = 0
    this.stun = 0
    this.invulnerable = 0
    this.continued = false
    this.canContinue = canContinue && this.rules.canContinue
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
    this.opts.progress.record({ type: 'start' })
    if (this.weather !== 'clear') {
      const label = i18n.t(`weather.${this.weather}`)
      this.floaters.show(label, this.layout.worldW / 2, this.mouth.y - 230, PALETTE.white, 30)
    }
    this.clock.reset()
    this.ensureRunning()
    this.pushHud(true)
  }

  pause() {
    if (this.mode !== 'playing') return
    this.mode = 'paused'
    this.pendingTap = null
    this.opts.buzz.silence()
    this.opts.ambience.silence()
    this.opts.music.setMood('paused')
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
    this.swarm.scatter(this.zone, 'hazard')
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
    this.swarm.scatter(this.zone, 'hazard')
    this.heron.cancel()
    this.pofik.setHiding(false)
    this.bitterShots = 0
    this.burp = 0
    this.endPower(false)
    this.setWeather('clear')
    if (this.pofik.isDead) this.pofik.revive()
    this.vignette.setDanger(0)
    this.hints.hide()
    this.ensureRunning()
    this.pushHud(true)
  }

  setLook(look: Look) {
    this.pofik.setLook(look)
  }

  /** High-contrast hazards: a white and red ring around everything that hurts. */
  setContrast(on: boolean) {
    this.swarm.setContrast(on)
  }

  /** Pond decorations; the sign shows the best score. */
  setDecor(decor: readonly DecorId[], best: number) {
    this.pond.setDecor(decor, best)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.resizeObserver.disconnect()
    this.app.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.app.ticker.remove(this.frame)
    this.events.clear()
    this.opts.buzz.silence()
    this.opts.ambience.silence()
    this.app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
  }

  /** Read-only view of the run, for debugging and automated checks. */
  snapshot() {
    return {
      mode: this.mode,
      playMode: this.playMode,
      hearts: this.hearts,
      timeLeft: this.timeLeft,
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
      top: this.zoneTop(),
      bottom: this.layout.flyBottom,
      worldW: W,
      worldH: H,
    }
    this.vignette.resize(width, height)
    this.pofik.setSeat(W / 2, this.layout.padY - 6 + this.pond.padBob)
    if (!this.app.ticker.started) this.renderFrame(0)
  }

  /** Insects keep lower under the rain clouds. */
  private zoneTop() {
    return this.layout.flyTop + (this.weather === 'rain' ? CONFIG.weather.rainLower : 0)
  }

  private setWeather(weather: Weather) {
    this.weather = weather
    this.pond.setWeather(weather)
    if (this.zone) this.zone.top = this.zoneTop()
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
    this.pofik.setAmbient(ambient, this.mode === 'attract' ? 0 : rules.skyPhase(this.runTime))
    this.tongue.view.tint = ambient
    this.swarm.setAmbient(
      this.power === 'freeze' ? mixColor(ambient, PALETTE.freeze, 0.45) : ambient,
    )
    this.pofik.render()
    this.pofik.tongueRoot(this.mouth)
    this.tongue.render(this.mouth)
    this.swarm.sync()
    this.updateBuzz()
    this.updateAmbience()
    this.updateMusic()
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

    // A cold snap slows down everything that flies (and the fish), not Pofik.
    const insectDt = this.power === 'freeze' ? dt * CONFIG.power.freeze.scale : dt
    this.updateEnv()
    this.updateFish(insectDt)
    this.updateHeron(dt)
    this.swarm.update(insectDt, this.zone)
    this.updateSparkles(dt)
    this.updateLook()
    this.pofik.update(dt)
    this.particles.update(dt)
    this.floaters.update(dt)
    this.hints.update(dt, this.layout.worldW, this.layout.flyTop)
  }

  private runStep(dt: number) {
    this.runTime += dt
    this.tickTimer -= dt
    if (this.tickTimer <= 0) {
      this.tickTimer += 1
      this.opts.progress.record({ type: 'tick', runTime: this.runTime - this.runStart })
    }
    if (this.stun > 0) this.stun -= dt
    if (this.invulnerable > 0) this.invulnerable -= dt
    // The combo clock waits while the tongue is out, so a catch in flight still counts.
    if (this.comboTimer > 0 && !this.tongue.busy) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.chain = 0
    }
    if (this.runTime >= 120 && this.rules.hunger) this.achieve('survive2m')

    this.idleTime += dt
    if (this.idleTime > CONFIG.yawnAfter && !this.tongue.busy && this.stun <= 0) {
      this.idleTime = 0
      this.pofik.yawn()
      this.opts.sound.yawn()
    }

    if (this.rules.timeLimit !== null) {
      this.timeLeft = Math.max(0, this.timeLeft - dt)
      if (this.timeLeft <= 0) {
        this.die('time')
        return
      }
    }

    if (this.rules.hunger) this.hunger = rules.drainHunger(this.hunger, dt, this.runTime)
    else this.hunger = CONFIG.hunger.max
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

    const rulesNow = modeDifficulty(this.rules, rules.difficulty(this.runTime))
    this.swarm.spawnTick(dt, rulesNow, this.zone)
    this.updatePower(dt, rulesNow.fly.speed)
    this.updateHints(dt)

    if (!this.rules.hazards) return
    this.heronTimer -= dt
    if (this.heronTimer <= 0 && !this.heron.busy) {
      this.heronTimer = this.eventRng.range(...CONFIG.heron.interval)
      this.startHeron()
    }
  }

  private attractStep(dt: number) {
    this.pofik.setHunger(1)
    this.pofik.setHiding(false)
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
      this.opts.progress.record({
        type: 'end',
        score: this.score,
        catches: this.runCatches,
        misses: this.runMisses,
      })
      this.events.emit('runOver', {
        score: this.score,
        cause: this.deathCause,
        canContinue: this.canContinue && !this.continued,
        seed: this.runSeed,
        bestCombo: this.runBestCombo,
        stings: this.runStings,
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
      this.opts.progress.record({ type: 'boop' })
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
    const scored = this.mode === 'playing'
    this.fire(aim.x, aim.y, scored)
    if (scored && this.heron.watching && !this.heron.spotted) this.onSpotted()
  }

  private fire(tx: number, ty: number, scored: boolean) {
    let launch = 1
    if (scored && this.bitterShots > 0) {
      this.bitterShots--
      launch = CONFIG.bitter.launchScale
    }
    this.tongue.fire(this.mouth.x, this.mouth.y, tx, ty, scored, launch)
    const d = Math.hypot(tx - this.mouth.x, ty - this.mouth.y) || 1
    this.pofik.shoot((tx - this.mouth.x) / d)
    this.opts.sound.shoot()
    this.stickCount = 0
    this.bullseyes = 0
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
      if (it.kind === 'spider' && !t.snagged && !t.stung && this.touchesSilk(it)) {
        this.onSnag(it)
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
    const t = this.tongue
    const r = CONFIG.bullseye.radius
    const centered =
      distSqPointSegment(fly.x, fly.y, t.prevTipX, t.prevTipY, t.tipX, t.tipY) <= r * r
    if (centered && fly.kind !== 'ladybug' && this.mode === 'playing') this.onBullseye(fly)
  }

  /** Dead-center hit: a ring, a sharp ding and a bonus point when swallowed. */
  private onBullseye(fly: Insect) {
    this.bullseyes++
    this.particles.ring(fly.x, fly.y, PALETTE.white, 8, 46, 0.3)
    this.particles.ring(fly.x, fly.y, PALETTE.sting, 4, 26, 0.25)
    this.floaters.show(i18n.t('game.bullseye'), fly.x, fly.y - 26, PALETTE.white, 22)
    this.opts.sound.bullseye()
    this.opts.progress.record({ type: 'bullseye' })
    this.achieve('bullseye')
  }

  /** The tip crossed or touched a spider's thread this step. */
  private touchesSilk(spider: Insect) {
    const t = this.tongue
    const { x0, y0, x1, y1 } = spider.thread()
    const near = CONFIG.spider.snagRadius + CONFIG.tongue.tipRadius * 0.5
    return (
      segmentsIntersect(t.prevTipX, t.prevTipY, t.tipX, t.tipY, x0, y0, x1, y1) ||
      distSqPointSegment(t.tipX, t.tipY, x0, y0, x1, y1) <= near * near
    )
  }

  private onSnag(spider: Insect) {
    const t = this.tongue
    t.snag()
    spider.pluck()
    this.particles.burst({
      x: t.tipX,
      y: t.tipY,
      count: 6,
      colors: [PALETTE.silk, PALETTE.white],
      speed: [40, 110],
      life: [0.25, 0.45],
      size: [3, 6],
      drag: 4,
    })
    this.floaters.show(i18n.t('game.sticky'), t.tipX, t.tipY - 14, PALETTE.silk, 24)
    this.opts.sound.snag()
    this.opts.haptics.light()
    this.shake.add(0.08)
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
    const spider = bee.kind === 'spider'
    this.floaters.show(
      i18n.t(spider ? 'game.bite' : 'game.ouch'),
      t.tipX,
      t.tipY - 16,
      PALETTE.sting,
      30,
    )
    this.clock.hitStopFor(CONFIG.fx.hitStopSting)
    this.shake.add(CONFIG.fx.stingTrauma)
    this.vignette.flash()
    if (spider) this.opts.sound.bite()
    else this.opts.sound.sting()
    this.opts.haptics.sting()
    this.pofik.sting(CONFIG.stun)
    const duckX = this.pond.startle()
    if (duckX !== null) this.opts.sound.quack(this.panOf(duckX))
    if (bee.kind === 'bee') this.opts.hints.markDone('avoidBee')

    if (this.mode !== 'playing') return
    const cost = spider ? CONFIG.hunger.bite : CONFIG.hunger.sting
    this.penalize(cost, CONFIG.stun, CAUSE[bee.kind as HazardKind], bee.kind as HazardKind)
  }

  /** A sting, bite or peck: costs belly, stuns Pofik and ends the combo. */
  private penalize(hungerCost: number, stun: number, cause: DeathCause, by: StingSource) {
    this.opts.progress.record({ type: 'sting', by })
    this.runStings++
    if (this.rules.hunger) this.hunger = Math.max(0, this.hunger - hungerCost)
    else if (this.rules.stingPoints > 0) {
      this.score = stingScore(this.rules, this.score)
      this.floaters.show(
        `-${this.rules.stingPoints}`,
        this.mouth.x,
        this.mouth.y - 112,
        PALETTE.sting,
        34,
      )
    }
    this.stun = stun
    this.resetCombo()
    this.streak = 0
    this.pendingTap = null
    this.events.emit('stung', { hunger: this.hunger })
    if (rules.isStarved(this.hunger)) this.die(cause)
  }

  private onTongueHome() {
    const t = this.tongue
    const n = t.attached.length
    const scored = t.scored && this.mode === 'playing'
    this.pofik.tongueHome()
    if (n === 0) {
      this.opts.sound.retract()
      // A miss ends the combo and the streak.
      if (scored) this.onMiss()
      return
    }
    const kinds: PreyKind[] = []
    let power: PowerKind | null = null
    for (const it of t.attached) {
      if (it.isPrey) kinds.push(it.kind as PreyKind)
      if (it.kind === 'beetle') power = it.power
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

    if (scored) {
      this.scoreCatch(kinds)
      if (power) this.startPower(power)
    }
  }

  private scoreCatch(all: PreyKind[]) {
    const bitter = all.includes('ladybug')
    if (bitter) this.onYuck()
    // Ladybugs don't count: a shot with only ladybugs is as good as a miss.
    const kinds = all.filter((k) => k !== 'ladybug')
    if (kinds.length === 0) {
      this.recordCatch(all)
      this.onMiss()
      return
    }
    const n = kinds.length
    const { points, food } = rules.preyValue(kinds)
    const before = rules.comboMultiplier(this.chain)
    this.chain += n
    this.comboTimer = CONFIG.combo.window
    const multiplier = rules.comboMultiplier(this.chain)
    this.runBestCombo = Math.max(this.runBestCombo, multiplier)
    const completed = rules.trackSets(this.sets, kinds)
    const bonus = rules.setBonus(completed) + this.bullseyes * CONFIG.bullseye.points
    const gained = (points * multiplier + bonus) * (this.power === 'double' ? 2 : 1)
    this.score += gained
    if (this.rules.hunger) this.burp = Math.min(1, this.burp + rules.burpGain(this.hunger, food))
    this.hunger = rules.feed(this.hunger, food)
    this.streak += n

    const { x, y } = this.mouth
    const golden = kinds.includes('golden')
    const size = golden || gained >= 5 ? 44 : gained > 1 ? 40 : 34
    if (this.rules.score)
      this.floaters.show(`+${gained}`, x, y - 112, golden ? PALETTE.gold : PALETTE.white, size)
    if (golden) {
      this.opts.sound.goldenCatch()
      this.goldBurst(x, y - 20, 22)
    } else if (kinds.includes('dragonfly')) this.opts.sound.catchSpecial('dragonfly')
    else if (kinds.includes('firefly')) this.opts.sound.catchSpecial('firefly')
    else if (kinds.includes('moth')) this.opts.sound.catchSpecial('moth')
    if (multiplier > before && this.rules.score) this.onComboUp(multiplier)
    if (this.nearBee && !this.tongue.stung) this.onCloseCall()
    if (completed.length && this.rules.score) this.onSet(completed[completed.length - 1])
    if (this.burp >= 1) this.onBurp()

    this.opts.hints.markDone('tapFly')
    this.runCatches += n
    this.idleTime = 0
    this.recordCatch(all)
    this.events.emit('caught', { count: n, score: this.score })

    if (golden) this.achieve('golden')
    if (kinds.includes('dragonfly')) this.achieve('dragonfly')
    if (kinds.includes('firefly')) this.achieve('firefly')
    if (kinds.includes('moth')) this.achieve('moth')
    if (n >= 3) this.achieve('multi3')
    if (multiplier >= 5) this.achieve('combo5')
    if (this.streak >= 10) this.achieve('streak10')
    if (this.score >= 100) this.achieve('score100')
  }

  private recordCatch(kinds: PreyKind[]) {
    this.opts.progress.record({
      type: 'catch',
      kinds,
      combo: rules.comboMultiplier(this.chain),
      night: rules.skyPhase(this.runTime) >= CONFIG.spawn.firefly.minSky,
      score: this.score,
    })
  }

  /** An empty shot: ends the combo and, in Sharpshooter, costs a heart. */
  private onMiss() {
    this.resetCombo()
    this.streak = 0
    this.runMisses++
    this.opts.progress.record({ type: 'miss' })
    if (this.rules.hearts === null || this.mode !== 'playing') return
    this.hearts = Math.max(0, this.hearts - 1)
    this.opts.sound.heartLost()
    this.opts.haptics.light()
    this.floaters.show(i18n.t('game.miss'), this.mouth.x, this.mouth.y - 150, PALETTE.sting, 30)
    if (this.hearts <= 0) this.die('missed')
  }

  /** Three of the same kind in a row. */
  private onSet(kind: PreyKind) {
    const { x, y } = this.mouth
    const bonus = CONFIG.set.bonus * CONFIG.prey[kind].points
    this.floaters.show(i18n.t('game.set', { n: bonus }), x + 70, y - 200, PALETTE.star, 26)
    this.particles.ring(x + 70, y - 200, PALETTE.star, 10, 60, 0.35)
    this.opts.sound.set()
    this.opts.progress.record({ type: 'set' })
    this.achieve('set')
  }

  /** A full burp meter: a shockwave that sends every hazard packing. */
  private onBurp() {
    this.burp = 0
    const { x, y } = this.mouth
    this.score += CONFIG.burp.points
    this.pofik.burp()
    this.opts.sound.burp()
    this.opts.haptics.heavy()
    this.shake.add(0.35)
    this.particles.ring(x, y - 20, PALETTE.white, 30, 520, 0.6, 0.9)
    this.particles.ring(x, y - 20, PALETTE.puff, 20, 360, 0.5, 0.7)
    this.particles.burst({
      x,
      y: y - 20,
      count: 16,
      colors: [PALETTE.puff, PALETTE.white, PALETTE.bodyLight],
      speed: [160, 340],
      angle: [Math.PI + 0.2, TAU - 0.2],
      life: [0.4, 0.8],
      size: [8, 16],
      drag: 2.5,
    })
    this.floaters.show(i18n.t('game.burp'), x, y - 180, PALETTE.white, 46)
    for (const it of this.swarm.list) if (it.isHazard && it.free) it.flee(x, y, this.time)
    this.swarm.scatter(this.zone, 'hazard')
    this.opts.progress.record({ type: 'burp' })
    this.achieve('burp')
  }

  private startPower(kind: PowerKind) {
    this.power = kind
    this.powerTime = CONFIG.power[kind].duration
    this.frenzyTimer = 0
    const { x, y } = this.mouth
    this.floaters.show(i18n.t(`game.${kind}`), x, y - 230, POWER_COLORS[kind], 34)
    this.particles.ring(x, y - 60, POWER_COLORS[kind], 20, 240, 0.5)
    this.opts.sound.powerUp(kind)
    this.opts.haptics.light()
    this.opts.progress.record({ type: 'power' })
  }

  private endPower(announce: boolean) {
    if (this.power && announce) this.opts.sound.powerEnd()
    this.power = null
    this.powerTime = 0
  }

  private updatePower(dt: number, flySpeed: number) {
    if (!this.power) return
    this.powerTime -= dt
    if (this.powerTime <= 0) {
      this.endPower(true)
      return
    }
    if (this.power === 'freeze' && this.fxRng.chance(dt * 6)) {
      this.particles.burst({
        x: this.fxRng.range(this.zone.left, this.zone.right),
        y: this.zone.top - 20,
        count: 1,
        shape: 'star',
        colors: [PALETTE.white, PALETTE.freeze],
        speed: [20, 50],
        angle: [Math.PI * 0.4, Math.PI * 0.6],
        life: [1.2, 1.8],
        size: [6, 10],
        gravity: 40,
        drag: 0.5,
        spin: 2,
      })
    }
    if (this.power !== 'frenzy') return
    // Extra flies come from the effects stream so seeded spawns stay the same.
    const F = CONFIG.power.frenzy
    this.frenzyTimer -= dt
    if (this.frenzyTimer > 0 || this.swarm.count('fly') >= F.maxFlies) return
    this.frenzyTimer = F.every
    this.swarm.spawnExtra('fly', this.fxRng, this.zone, flySpeed)
  }

  /** Swallowed a ladybug: a grimace and a slower next shot. */
  private onYuck() {
    const { x, y } = this.mouth
    this.bitterShots = CONFIG.bitter.shots
    this.pofik.yuck()
    this.opts.sound.yuck()
    this.opts.haptics.light()
    this.floaters.show(i18n.t('game.yuck'), x, y - 140, PALETTE.yuck, 30)
    this.particles.burst({
      x,
      y: y - 10,
      count: 8,
      colors: [PALETTE.yuck, PALETTE.ladybug],
      speed: [60, 160],
      angle: [Math.PI + 0.4, TAU - 0.4],
      life: [0.3, 0.55],
      size: [5, 9],
      gravity: 300,
      drag: 3,
    })
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
    if (multiplier >= 4) {
      const frogX = this.pond.cheer()
      if (frogX !== null) this.opts.sound.croak(this.panOf(frogX))
    }
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
    this.sets.kind = null
    this.sets.count = 0
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
    this.pendingTap = null
    if (cause === 'time') {
      // Rush ran out: not a defeat, so no slump and no sad trombone.
      this.slumpDelay = 0
      this.pofik.gulp(1)
      this.opts.sound.timeUp()
      this.opts.haptics.light()
    } else {
      const hit = cause !== 'starved' && cause !== 'missed'
      this.slumpDelay = hit ? 0.45 : 0
      if (this.rules.hunger) this.hunger = 0
      if (!hit) this.pofik.slump()
      this.opts.sound.gameOver()
      this.opts.haptics.heavy()
    }
    this.resetCombo()
    this.endPower(false)
    this.swarm.scatter(this.zone)
    this.heron.cancel()
    this.pofik.setHiding(false)
    this.vignette.setDanger(0)
    this.hints.hide()
    this.pushHud(true)
  }

  // Pond events ---------------------------------------------------------------

  /** Shared flight inputs: the tongue tip for wasps, the light for moths, the wind. */
  private updateEnv() {
    // Run time, not game time: the gusts are part of the seeded run.
    this.wind = this.weather === 'wind' ? windAt(this.runTime, this.windDir) : 0
    this.tongue.wind = this.wind
    this.pond.setWind(this.wind)
    this.pond.setFog(this.mode === 'attract' ? 0 : fogAt(this.runTime))
    const env = this.swarm.env
    env.wind = this.wind
    const t = this.tongue
    env.lure = t.busy && !t.stung && !t.snagged
    env.lureX = t.tipX
    env.lureY = t.tipY
    const light = this.pond.light
    env.lightX = light.x
    env.lightY = Math.max(light.y, this.zone.top + 30)
  }

  private updateFish(dt: number) {
    const fish = this.fish
    if (!fish.busy && (this.mode === 'playing' || this.mode === 'attract')) {
      this.fishTimer -= dt
      if (this.fishTimer <= 0) {
        const rng = this.mode === 'playing' ? this.eventRng : this.fxRng
        this.fishTimer = rng.range(...CONFIG.fish.interval)
        const target = this.lowestPrey()
        if (target) fish.lurk(target, this.layout.waterY, rng.sign())
      }
    }
    if (fish.state === 'lurk' && this.fxRng.chance(dt * 9)) {
      this.particles.burst({
        x: fish.bubbleX + this.fxRng.range(-14, 14),
        y: this.layout.waterY + 22,
        count: 1,
        colors: [PALETTE.white, PALETTE.waterLine],
        speed: [10, 30],
        angle: [-Math.PI * 0.6, -Math.PI * 0.4],
        life: [0.35, 0.6],
        size: [3, 6],
        gravity: -40,
        drag: 2,
      })
    }
    const event = fish.update(dt)
    if (event === 'jump') {
      this.opts.sound.fishLeap(this.panOf(fish.bubbleX))
      this.splashAt(fish.bubbleX, 0.8)
    } else if (event === 'apex') {
      fish.trySnatch()
    } else if (event === 'splash') {
      this.opts.sound.splash(this.panOf(fish.mouthX))
      this.splashAt(fish.mouthX, 1)
    }
  }

  /** The prey closest to the water, if one flies low enough for the fish. */
  private lowestPrey() {
    let best: Insect | null = null
    const limit = this.zone.bottom - CONFIG.fish.band
    for (const it of this.swarm.list) {
      if (!it.free || !it.isPrey || it.y < limit) continue
      if (it.x < this.zone.left || it.x > this.zone.right) continue
      if (!best || it.y > best.y) best = it
    }
    return best
  }

  private splashAt(x: number, strength: number) {
    const y = this.layout.waterY + 10
    this.pond.ripple(x, y + 8, strength * 0.7)
    this.particles.burst({
      x,
      y,
      count: Math.round(10 * strength),
      colors: [PALETTE.white, PALETTE.waterLine, PALETTE.waterTop],
      speed: [80, 200],
      angle: [Math.PI + 0.3, TAU - 0.3],
      life: [0.35, 0.6],
      size: [4, 8],
      gravity: 620,
      drag: 1.5,
    })
  }

  private startHeron() {
    const { worldW, worldH } = this.layout
    const y = (this.zone.top + this.zone.bottom) / 2 - 40
    this.heron.start(this.eventRng.sign(), worldW, worldH, y)
    this.opts.sound.heronCall()
    this.floaters.show(
      i18n.t('game.holdStill'),
      this.mouth.x,
      this.mouth.y - 190,
      PALETTE.white,
      30,
    )
  }

  private updateHeron(dt: number) {
    const heron = this.heron
    const event = heron.update(dt)
    this.pofik.setHiding(heron.busy && this.mode === 'playing')
    if (event === 'done' && !heron.spotted && this.mode === 'playing') this.achieve('heron')
  }

  /** Shot while the heron was watching: it swoops down and pecks. */
  private onSpotted() {
    const heron = this.heron
    heron.spotted = true
    this.tongue.yank()
    this.particles.burst({
      x: this.mouth.x,
      y: this.mouth.y - 90,
      count: 10,
      shape: 'star',
      colors: [PALETTE.white, PALETTE.star],
      speed: [140, 300],
      life: [0.3, 0.55],
      size: [8, 14],
      drag: 4,
      spin: 7,
    })
    this.floaters.show(i18n.t('game.spotted'), this.mouth.x, this.mouth.y - 170, PALETTE.sting, 32)
    this.clock.hitStopFor(CONFIG.fx.hitStopSting)
    this.shake.add(CONFIG.fx.stingTrauma)
    this.vignette.flash()
    this.opts.sound.peck()
    this.opts.haptics.sting()
    this.pofik.sting(CONFIG.heron.stun)
    this.penalize(CONFIG.heron.peck, CONFIG.heron.stun, 'heron', 'heron')
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
    if (this.heron.watching) {
      this.pofik.lookAt(this.heron.x, this.heron.birdY)
      return
    }
    const target =
      this.swarm.nearestFree('prey', this.mouth.x, this.mouth.y, this.zone) ??
      this.swarm.nearestFree('hazard', this.mouth.x, this.mouth.y, this.zone)
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

  private updateMusic() {
    const { music } = this.opts
    if (this.mode === 'paused') return
    if (this.mode === 'attract') music.setMood('title')
    else if (this.mode === 'playing') music.setMood(this.playMode === 'zen' ? 'zen' : 'run')
    else music.setMood('over')
    music.setIntensity(this.mode === 'playing' ? rules.comboMultiplier(this.chain) : 1)
    music.setNight(this.mode === 'attract' ? 0 : clamp(rules.skyPhase(this.runTime) - 1, 0, 1))
  }

  private updateAmbience() {
    if (this.mode === 'paused') return
    const { base, gust } = CONFIG.weather.wind
    const level =
      this.weather === 'wind'
        ? clamp(Math.abs(this.wind) / (base + gust), 0, 1)
        : this.weather === 'rain'
          ? 1
          : 0
    this.opts.ambience.update(this.weather, level)
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
    const bee = source('bee')
    const wasp = source('wasp')
    this.opts.buzz.update(
      source('prey'),
      !wasp || (bee && bee.proximity > wasp.proximity) ? bee : wasp,
    )
  }

  private pushHud(force: boolean) {
    const frame: HudFrame = {
      hunger: this.hunger / CONFIG.hunger.max,
      score: this.score,
      critical: this.mode === 'playing' && rules.isCritical(this.hunger),
      combo: rules.comboMultiplier(this.chain),
      burp: this.burp,
      power: this.power,
      powerLeft: this.power ? this.powerTime / CONFIG.power[this.power].duration : 0,
      hearts: this.hearts,
      timeLeft: this.timeLeft,
    }
    const last = this.hudLast
    const same =
      Math.abs(frame.hunger - last.hunger) < 0.0005 &&
      Math.abs(frame.burp - last.burp) < 0.005 &&
      Math.abs(frame.powerLeft - last.powerLeft) < 0.01 &&
      frame.score === last.score &&
      frame.critical === last.critical &&
      frame.combo === last.combo &&
      frame.power === last.power &&
      frame.hearts === last.hearts &&
      Math.ceil(frame.timeLeft) === Math.ceil(last.timeLeft)
    if (!force && same) return
    this.hudLast = frame
    this.opts.hud(frame)
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
          bee: it.isHazard,
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
