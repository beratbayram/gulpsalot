# Pofik

A portrait, mobile-first web game. Pofik is a chubby frog on a lily pad: tap anywhere
and his springy tongue shoots there. Flies fill his belly, bees sting. The belly drains
over time and the run ends when it is empty.

Rare golden flies, zig-zagging dragonflies and (once the sky turns to night) fireflies and
moths are worth more, and quick catches build a combo multiplier. Wasps chase the tongue,
spiders hang on sticky silk, ladybugs taste bitter, a fish snatches low flyers and a
heron's shadow means "hold still". Power-up beetles, bullseyes, matching sets and a burp
meter add to the score; each run has its own weather.

Besides the classic mode there are a Zen pond, a 60 second Rush and a Sharpshooter mode,
a daily challenge with a streak and a shareable result, friend challenges by link,
missions, lifetime stats, skins and hats (some secret), pond decorations, achievements,
synthesized music that follows the combo, and a Turkish and English UI.

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
| `pnpm test`      | Vitest (rules, progress, i18n, platform, lib) |

### URL flags

| Flag         | Effect                                                             |
| ------------ | ------------------------------------------------------------------ |
| `?debug`     | FPS and state line, hitboxes, insect zone, `window.__pofik` handle |
| `?slow=0.25` | Slow motion, for reviewing animation timing                        |
| `?seed=42`   | Deterministic insect spawns                                        |
| `?time=100`  | Start every run at this many seconds (difficulty, dusk and night)  |
| `?ads=mock`  | Fake rewarded/interstitial ads (default in dev)                    |
| `?ads=none`  | No ads (default in production)                                     |

A shared challenge link adds `?challenge=<seed>.<score>`; the game keeps it for the title
screen and removes it from the address.

## How it is put together

```
src/
  app/        React: screens, HUD, stores, styles, the Pixi host component
  game/       Pixi game: Game loop, entities, effects, background, rules, config
  audio/      Web Audio engine and synthesized sound recipes (no audio files)
  platform/   Storage, haptics, lifecycle, ad/store hooks (Capacitor seams)
  i18n/       English and Turkish strings, shared by the UI and the game
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
  (`src/audio/sfx.ts`). The nearest fly and bee each drive a quiet, panned buzz. The
  music (`src/audio/music.ts`) is made up on the fly: pad and bass always play, and
  percussion, melody, arpeggio and sparkles join as the combo climbs. Rain and wind have
  their own loops (`src/audio/weather.ts`).

### Tuning

Gameplay and feel numbers live in `src/game/config.ts`: hunger drain, points and food per
insect, combo window and steps, sting and bite penalties, spawn curves for every insect,
power-up durations, burp, set and bullseye bonuses, fish and heron timing, weather odds,
the day to night timeline, tongue springs, shake and hit-stop strengths. Mode rules are in
`src/game/modes.ts`. The difficulty curve is in `src/game/rules.ts` and covered by tests.
Skin and hat unlock scores are in `src/game/cosmetics.ts`.

### Progress and content

- **Combos.** Insects caught in quick succession (a multi-catch counts all at once) build a
  x2 to x5 score multiplier. The combo clock pauses while the tongue is out; a miss or a
  sting ends it.
- **Bonuses.** Three of the same insect in a row is a set; a dead-center hit is a
  bullseye; food eaten on a full belly fills a burp meter, and a full meter's burp sends
  every hazard away. Power-up beetles give a fly frenzy, a slow-motion cold snap or double
  points for a few seconds.
- **Modes** (`src/game/modes.ts`). Classic; Zen pond (no hazards, hunger or score); Rush
  (60 seconds, stings cost points); Sharpshooter (classic plus three hearts, every miss
  costs one). Rush and Sharpshooter keep their own best scores.
- **Daily challenge.** A run seeded from the local date (`src/game/daily.ts`). Each insect
  kind has its own spawn stream seeded from the run seed, and every spawn attempt draws the
  same numbers whether or not it is capped, so everyone gets the same insects in the same
  places regardless of frame rate or how they play. Pond events (fish, heron) and the
  weather come from the seed too, through their own generators; effects use a separate
  stream. No continue on daily runs. Finishing dailies on consecutive days builds a streak,
  and the result can be shared as a spoiler-free emoji line.
- **Friend challenges.** After a classic run the share button makes a link with that run's
  seed and score (`src/app/sharing.ts`); opening it offers the same run with the score to
  beat.
- **Missions** (`src/game/missions.ts`): three active goals from an endless list, counted
  in every mode but Zen. Finished missions unlock pond decorations (cattails, a lantern
  that moths circle, a score sign).
- **Lifetime stats** (`src/game/progress.ts`): insects per kind, ouches, play time, bests.
  The game reports run events through `GameOptions.progress`; the app keeps stats,
  missions and secret looks in its store.
- **Achievements** are listed in `src/game/achievements.ts`. The game unlocks them through
  `GameOptions.achievements`; the app stores them and shows a toast.
- **Skins and hats.** Hats are plain shape data (`src/game/draw/hats.ts`) drawn by both Pixi
  and the SVG face in the UI, so the wardrobe previews match the game. Three looks are
  secret, unlocked by playing after midnight, tickling Pofik 50 times and a run of 20
  catches without a miss.
- **Languages.** `src/i18n/en.ts` defines the keys; `tr.ts` must cover all of them (a test
  checks this, placeholders included). The language follows the device until the player
  picks one with the EN/TR button.

## Mobile notes

- iOS only allows audio after a tap, so the audio context unlocks on the first gesture.
- The Vibration API exists on Android browsers only. The vibration toggle is hidden where
  it is unsupported; native haptics come with Capacitor.
- Portrait only. Phones held sideways see a "turn your phone" overlay and the game pauses.
- The game pauses automatically when the tab or app goes to the background.
- The screen stays on during a run (Screen Wake Lock, where supported).
- Installed PWAs show an icon badge while today's daily is waiting (Badging API, where
  supported).
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
   - `platform/notifications.ts`: `@capacitor/local-notifications` for the daily reminder
     (the web build has a no-op; the game already schedules it after each daily)
   - `platform/share.ts`: `@capacitor/share`
   - `platform/wakeLock.ts`: a keep-awake plugin
4. Lock orientation and hide the status bar in the native projects.
5. `pnpm build && pnpm exec cap sync`

The service worker is not needed inside Capacitor and can be disabled for that build.

## Ads and purchases

`src/platform/monetization/` defines the interface the game uses: gameplay start/stop,
a rewarded "continue" on the game-over screen (once per run), a frequency-capped
interstitial between runs, and a remove-ads entitlement. The web build ships the no-op
provider, so none of this shows up for players yet.
