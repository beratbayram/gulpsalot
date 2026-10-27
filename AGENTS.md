# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

Pofik is a portrait, mobile-first web game (React 19, PixiJS 8, TypeScript, Vite 8) shipped
as an offline-capable PWA. Package manager is pnpm, Node >= 22.12. `README.md` has the
player-facing rules, deploy setup and the Capacitor plan; `IDEAS.md` holds parked ideas.

## Commands

```bash
pnpm dev                               # open http://localhost:5173/pofik/ (LAN accessible)
pnpm build                             # tsc -b, vite build, service worker
pnpm preview                           # serve the production build
pnpm typecheck                         # tsc -b
pnpm lint                              # oxlint
pnpm format                            # prettier --write .
pnpm test                              # vitest run (all src/**/*.test.ts)
pnpm test src/game/rules.test.ts       # one file
pnpm test -t "drains faster"           # tests matching a name
pnpm test:watch
```

The app is served under the `/pofik/` base path in dev too; `localhost:5173/` alone shows
nothing. Tests run in Vitest's `node` environment: no DOM, no Pixi.

URL flags for checking behavior: `?debug` (FPS, hitboxes, insect zone), `?slow=0.25`
(time scale), `?seed=42` (deterministic spawns), `?time=100` (start runs later in the
difficulty and day/night curve), `?ads=mock` / `?ads=none` (mock is the dev default). A friend's challenge link is
`?challenge=<seed>.<score>`.
In dev or with `?debug`, `window.__pofik` is the `Game` instance: `snapshot()` returns
the run state and insect positions, `worldToCanvas()` converts world points for
synthetic taps.

## Architecture

### Layers and dependency direction

- `src/game/` is the Pixi game. It never imports React, `app/`, `audio/` or `platform/`.
  Everything external (sound, buzz, weather ambience, music, haptics, HUD output, hint
  and achievement persistence, progress events for stats and missions) arrives as sinks
  in `GameOptions`, wired in `src/app/GameHost.tsx`. It may use `lib/` and `i18n/`.
- `src/app/` is the React UI layered over the canvas: screens, HUD, zustand stores.
- `src/audio/`, `src/platform/`, `src/i18n/`, `src/lib/` are leaf modules.
- Boot order (`src/main.tsx`): `storage.init()` (async), store `hydrate()`, `setLang`,
  `audio.install()`, then the Fredoka font and `monetization.init()`, then render. Pixi
  text needs the font loaded first. Storage reads are synchronous after `init()`.

### React and game bridge

- `GameHost` creates the `Game` once (`Game.create` is async) and exposes it through
  `GameContext` / `useGame()`.
- React to game: go through `src/app/actions.ts` (`play`, `pause`, `resume`, `home`,
  `continueWithAd`, ...). These keep `game` mode, the app `screen` and monetization
  `gameplayStart/Stop` in sync; don't call `game.pause()` etc. directly from components.
- Game to React: `game.events` (`caught`, `stung`, `runOver`) and `opts.hud(frame)`,
  which writes `useHudStore`. React never renders per frame: per-frame consumers like
  `HungerBar` subscribe to `useHudStore` outside React and write CSS variables.
- Two state machines run side by side: `useAppStore.screen` (boot, title, wardrobe,
  achievements, modes, missions, stats, playing, paused, over) and `Game.mode` (attract,
  playing, paused, dying, over). Menus sit on top of `attract`, a demo mode where Pofik
  shoots flies by himself.
- Run modes: the app's `RunMode` is a `PlayMode` (`classic | zen | rush | sharp`, rules
  in `game/modes.ts`) or `daily` / `challenge`, which play classic rules on a fixed seed.
  `playModeOf` maps one to the other; `Game.startRun({ mode, seed })` takes the rules.
- `useAppStore` owns persisted progress (best, per-mode bests, settings, look, hints,
  achievements, daily record and streak, stats, missions, secret looks, decorations).
  Each setter writes through `platform/storage` (keys prefixed `pofik:v1:`). Stored data
  is sanitized on hydrate (`isAchievementId`, `sanitizeLook`, `sanitizeStats`,
  `sanitizeMissions`, `sanitizeStreak`, `sanitizeDecor`), so keep that when adding
  persisted fields. `record(event)` turns the game's progress events into stats,
  mission progress and secret unlocks; toasts are typed (achievement, mission, secret, decor).

### Simulation

- `Game.frame` hands the frame time to `StepClock.advance`, which splits it into equal
  sub-steps of at most 1/120 s, applies hit-stop and the debug time scale, and calls
  `step(dt)`. `renderFrame` runs once per frame. Time-dependent logic belongs in `step`
  using its `dt`. Pausing stops the Pixi ticker entirely.
- Taps are buffered (`pendingTap`, `CONFIG.tongue.inputBuffer`) and consumed inside the
  step, not in the pointer handler.
- Game code works in world units: fixed width 400, height 700 to 900 depending on aspect.
  `computeLayout` / `toWorld` in `layout.ts` convert from CSS pixels.
- Determinism (the daily challenge and friend challenges depend on it): `Swarm` keeps one
  spawn stream per timed kind, reseeded from the run seed (`Swarm.reseed`), so the order
  kinds come due in never changes their numbers. `eventRng` drives the fish and heron;
  the weather and wind side come from `pickWeather` / `windSide` (own generators); `fxRng`
  covers effects, attract mode and frenzy spawns (`Swarm.spawnExtra`). Never draw from
  these for anything else, keep `Swarm.spawnTick` drawing the same numbers per attempt
  whether or not the spawn is capped, append new kinds at the end of `TIMED`, and keep
  spawn positions independent of player settings (decorations, contrast). Run-time
  effects use `runTime`, not `time`. Otherwise every player's daily run changes.
- Tunables live in `src/game/config.ts` (`CONFIG`); put new numbers there, not inline in
  entities. Pure logic (difficulty ramp, hunger, combos, sky phase) lives in `rules.ts`
  and is covered by `rules.test.ts`. Keep testable logic out of Pixi classes, since tests
  can't construct them.
- Entities (`Pofik`, `Tongue`, `Insect`, `Swarm`) own Pixi containers and are drawn with
  `Graphics`. Motion is damped springs (`lib/spring.ts`); the tongue is a Verlet rope.
  `Swarm` pools insects per kind.

### Art, sound, text

- No image or audio assets. Game colors come from `PALETTE` (`game/draw/palette.ts`),
  mirrored by hand in `app/styles/tokens.css`; change both together.
- Hats are shape data (`game/draw/hats.ts`) drawn by both Pixi and the SVG `PofikFace`,
  so the wardrobe preview matches the game.
- Sounds are synthesized (`audio/sfx.ts`, `audio/synth.ts`). The game only knows the
  `SoundSink` interface in `Game.ts`; a new sound is added there and implemented in `sfx`.
- i18n: `i18n/en.ts` defines the keys (`MessageKey`); `tr.ts` must cover every key with
  the same `{placeholders}` (enforced by `i18n.test.ts`). React uses `useT()` so it
  re-renders on language change; game code uses `t()`, which reads a module-level current
  language. Key patterns: `ach.<id>.title` / `ach.<id>.desc`, `skin.<id>`, `hat.<id>`.

### Adding content

- Achievement: add the id to `ACHIEVEMENTS` (`game/achievements.ts`), add its `ach.*`
  strings in both languages, unlock it from `Game` with `this.achieve(id)`.
- Skin or hat: `game/cosmetics.ts` (with `unlockAt` best score), shape data in
  `game/draw/hats.ts` for hats, `skin.*` / `hat.*` strings.
- Insect kind: `CONFIG.prey` / `insects` / `spawn`, `Difficulty` and `difficulty()` in
  `rules.ts`, `ATTRACT_RULES` in `Game.ts`, `modeDifficulty` in `modes.ts` (if it is a
  hazard or power-up), `Swarm` pools and timed kinds (append to `TIMED`), `Insect` flight
  table, drawing and `HAZARDS`, the `PREY` lists in `progress.ts` and `Stats.tsx`, and
  `insect.*` strings. The `Record<InsectKind, ...>` types flag most missing spots.
- Mission: add to `MISSIONS` in `game/missions.ts` (the list repeats with bigger targets),
  a `mission.*` string in both languages, and a `measure` case for a new goal type.
- Secret look: a skin or hat with `secret`, a `SecretId`, a `secret.*` hint string, and
  the unlock in `useAppStore` (`unlockSecret`).
- Decoration: `DECOR` in `cosmetics.ts` (with its mission count), drawing in
  `Pond.buildDecor`, art in `ui/decorArt.ts`, `decor.*` strings.

### Platform seams

`src/platform/` (storage, haptics, lifecycle, monetization, share, wake lock, app badge,
notifications) is where browser APIs are wrapped so they can be swapped for Capacitor
later. Keep new device APIs behind it. `notifications` is a no-op on the web; the daily
reminder only fires once a native implementation is swapped in.
The monetization provider is picked from `?ads=`, else mock in dev and the no-op provider
in production.

### Deploy constraints

Production is `www.beratbayram.com/pofik`, proxied by the main Next.js site to this
project on Vercel. Vite `base` is `/pofik/` and the service worker scope is `/pofik` (no
trailing slash), which requires the `Service-Worker-Allowed` header set in `vercel.json`
and mirrored in `vite.config.ts` `preview.headers`. Changing the base or scope means
updating both. `POFIK_BASE=./` produces relative paths for native builds.

## Conventions

- Prettier: no semicolons, single quotes, trailing commas, print width 100.
- TypeScript is strict with `verbatimModuleSyntax` (use `import type`) and
  `erasableSyntaxOnly` (no enums, namespaces or constructor parameter properties; classes
  declare and assign fields explicitly).
- Comments are short English doc comments that explain intent, matching existing code.
