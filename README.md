# Pofik

A portrait, mobile-first web game. Pofik is a chubby frog on a lily pad: tap anywhere
and his springy tongue shoots there. Flies fill his belly, bees sting. The belly drains
over time and the run ends when it is empty.

Built with React, PixiJS and TypeScript. Ships as an installable, offline-capable PWA.
Android and iOS builds come later through Capacitor (see below).

## Getting started

```bash
pnpm install
pnpm dev
```

The game is served under `/pofik/`, like in production: open
`http://localhost:5173/pofik/`. `pnpm dev` also listens on your LAN, so you can open the
printed `Network` URL (plus `/pofik/`) on a phone on the same Wi-Fi. That is the best way
to judge feel, sound and haptics.

| Script           | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Dev server with HMR (LAN accessible)          |
| `pnpm build`     | Type-check, production build, service worker  |
| `pnpm preview`   | Serve the production build (LAN accessible)   |
| `pnpm typecheck` | `tsc -b`                                      |
| `pnpm lint`      | oxlint                                        |
| `pnpm format`    | Prettier                                      |
| `pnpm test`      | Vitest (springs, collisions, rules, platform) |

### URL flags

| Flag         | Effect                                                             |
| ------------ | ------------------------------------------------------------------ |
| `?debug`     | FPS and state line, hitboxes, insect zone, `window.__pofik` handle |
| `?slow=0.25` | Slow motion, for reviewing animation timing                        |
| `?seed=42`   | Deterministic insect spawns                                        |
| `?ads=mock`  | Fake rewarded/interstitial ads (default in dev)                    |
| `?ads=none`  | No ads (default in production)                                     |

## How it is put together

```
src/
  app/        React: screens, HUD, stores, styles, the Pixi host component
  game/       Pixi game: Game loop, entities, effects, background, rules, config
  audio/      Web Audio engine and synthesized sound recipes (no audio files)
  platform/   Storage, haptics, lifecycle, ad/store hooks (Capacitor seams)
  lib/        Springs, noise, RNG, math
```

- **React never renders per frame.** The game runs its own loop in Pixi and talks to
  React through events (`caught`, `stung`, `runOver`) and a small HUD store. The hunger
  bar subscribes outside React and writes CSS variables directly.
- **Fixed sub-steps.** Each frame is split into steps of at most 1/120 s, so springs and
  collisions behave the same at 60, 90 or 120 Hz. Hit-stop freezes the simulation for a
  few milliseconds on impacts.
- **Springs everywhere.** The tongue tip, Pofik's squash and stretch, lean, eyes, belly
  and most reactions are damped springs (`src/lib/spring.ts`). The tongue body is a short
  Verlet rope so fast shots whip and curve.
- **All art is code.** Pofik, insects and the pond are drawn with Pixi Graphics; the UI
  uses the same palette (`src/game/draw/palette.ts`, mirrored in `tokens.css`).
- **All sound is synthesized** with oscillators and filtered noise
  (`src/audio/sfx.ts`). The nearest fly and bee each drive a quiet, panned buzz.

### Tuning

Gameplay and feel numbers live in `src/game/config.ts`: hunger drain and rewards, sting
penalty, spawn curve, tongue springs, shake and hit-stop strengths. The difficulty curve
is in `src/game/rules.ts` and covered by tests.

## Mobile notes

- iOS only allows audio after a tap, so the audio context unlocks on the first gesture.
- The Vibration API exists on Android browsers only. The vibration toggle is hidden where
  it is unsupported; native haptics come with Capacitor.
- Portrait only. Phones held sideways see a "turn your phone" overlay and the game pauses.
- The game pauses automatically when the tab or app goes to the background.
- On desktop the game is shown in a phone-shaped frame.

## Deploying to beratbayram.com/pofik

Pofik is its own Vercel project. The main site (`beratbayramcom`, Next.js) proxies
`/pofik` and `/pofik/*` to it with a rewrite in its `next.config.ts`, so players only
ever see `www.beratbayram.com/pofik`.

```
www.beratbayram.com/pofik  ->  beratbayramcom (Next.js rewrite)  ->  pofik.vercel.app/pofik
```

- Assets are built with `base: '/pofik/'`. The public URL has no trailing slash (Next.js
  strips it), so the service worker uses scope `/pofik`, which needs the
  `Service-Worker-Allowed: /pofik` header set in `vercel.json`.
- `vercel.json` also maps `/pofik/*` back to the build output, sends hashed assets with a
  one-year immutable cache, keeps `sw.js` uncached, and redirects the bare deployment root
  to `/pofik`.

One-time setup:

1. Push this repo to GitHub.
2. In Vercel, import it as a new project named `pofik`. Framework, build command and
   output directory come from `vercel.json`; nothing to change.
3. Check the production domain Vercel assigns. If it is not `pofik.vercel.app`, set the
   `POFIK_ORIGIN` environment variable on the `beratbayramcom` project to it (for example
   `https://pofik-yourteam.vercel.app`).
4. Deploy `beratbayramcom` with the `/pofik` rewrite.

After that, every push to this repo's production branch updates the game; the website
does not need to redeploy.

## Going native later (Capacitor)

The code is already shaped for it: no URL routing, safe-area insets, and platform seams
in `src/platform/`. Rough steps:

1. `pnpm add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
2. `pnpm exec cap init Pofik <app id> --web-dir dist`, then `cap add android` / `cap add ios`
   (build with `POFIK_BASE=./ pnpm build` so paths are relative inside the app)
3. Swap implementations behind the existing seams:
   - `platform/storage.ts`: Capacitor Preferences backend
   - `platform/haptics.ts`: `@capacitor/haptics`
   - `platform/monetization/`: an ad SDK and store billing implementing `Monetization`
   - `platform/lifecycle.ts`: `@capacitor/app` pause/resume events
4. Lock orientation and hide the status bar in the native projects.
5. `pnpm build && pnpm exec cap sync`

The service worker is not needed inside Capacitor and can be disabled for that build.

## Ads and purchases

`src/platform/monetization/` defines the interface the game uses: gameplay start/stop,
a rewarded "continue" on the game-over screen (once per run), a frequency-capped
interstitial between runs, and a remove-ads entitlement. The web build ships the no-op
provider, so none of this shows up for players yet.
