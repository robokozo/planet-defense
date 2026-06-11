# Last Horizon — Alien Defense

An idle / auto-battler Alien Defense game: Vampire Survivors decisions on a
Missile Command battlefield. Your battery sits on the ground and auto-fires at
invaders raining from the sky; you only make decisions — in-run upgrade picks
on level-up, and cross-run progression on a Diablo-style paragon tree.

## Stack

- Vue 3 + TypeScript (strict, type-strippable) + Vite
- Vue Router (`/` menu, `/game` run, `/skills` paragon tree)
- Phaser 4 for the game scene (all sprites generated in code — no asset files)
- Pinia + VueUse `useLocalStorage` for persistent meta progression
- Tailwind CSS 4

## Game loops

**In-run (a "run"):** invaders spawn across the top in escalating 30s waves and
fall toward the buildings and cannons. Each cannon targets its most urgent
threat — the one closest to the ground — with predictive intercept aiming,
but only inside its range (shown as a faint arc). Kills drop XP gems; each
level pauses the game and offers 3 weapon/behavior cards drawn by rarity
(common/rare/epic/legendary — higher tiers start near zero odds and grow each
wave, boosted by Fortune-branch luck nodes). Every card has 5 star tiers, and
every owned weapon runs on every cannon with its own cooldown: flak guns,
cluster rockets, tesla arcs, nova pulses, rail guns, mid-air lockdown freezes,
angled strafing runs, cloud cover, nanite repair drones, and the BFG. Flat
stat growth — and the deep expansion nodes that grant extra cannons, weapon
slots, and +1 weapon tiers — live in the paragon tree, not in run cards. Ground impacts cost
integrity (one of five buildings collapses per 20% lost); at 0 the base is
lost. A speed button cycles the sim ×1 → ×2 → ×5 (sub-stepped so fast bullets
cannot tunnel through enemies), and weapon cooldown bars sit bottom-left.

**Cross-run:** runs award stardust (waves + kills + levels, scaled by tree
bonuses). Spend it on the paragon tree — 43 nodes in 6 rotationally symmetric
branches (Offense / Arsenal / Tech / Defense / Sensors / Fortune), generated
from one slot-geometry template rotated through 60°. Adjacent branches are
ring-linked at the fork tier, so you can path around the board without going
back through the core. Each branch ends in a keystone that changes how runs
start (Executioner, Twin Cannons, Nova Core, Aegis Protocol, Farsight
Protocol, Star Harvest). Free full-refund respec; saves from older tree
layouts migrate with a full refund.

## Architecture notes

- `src/game/eventBus.ts` — typed pub/sub bridging Phaser → Vue (HUD snapshots,
  level-up offers, run results) and Vue → Phaser (upgrade choice, pause, speed).
- `src/game/scenes/GameScene.ts` — the entire sim. No arcade physics: movement
  and collisions are manual squared-distance checks over plain arrays, run in
  capped sub-steps so the ×5 speed stays accurate.
- `src/skills/skillTree.ts` — branch definitions + the symmetric board
  generator, plus the pure functions that fold unlocked nodes into a run's
  starting stats.
- `src/game/data/balance.ts` — all tuning knobs in one place.

## Run

```sh
npm install
npm run dev
```

## Tooling

- `npm run lint` — oxlint
- `npm run format` / `npm run format:check` — oxfmt
- `npm run build` — vue-tsc + Vite (Rolldown)
