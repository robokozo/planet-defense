export type PatchNoteKind = 'new' | 'balance' | 'fix'

export interface PatchNote {
  kind: PatchNoteKind
  text: string
}

export interface PatchEntry {
  /** ISO date the patch shipped */
  date: string
  title: string
  /** optional one-line flavor under the title */
  blurb?: string
  notes: Array<PatchNote>
}

/**
 * Player-facing patch notes, newest first. Every gameplay-visible change
 * ships with an entry here — keep the language about what players feel,
 * not how it's implemented.
 */
export const PATCH_NOTES: Array<PatchEntry> = [
  {
    date: '2026-06-12',
    title: 'Eighty-Eight',
    blurb: 'The flak gun finally looks like flak.',
    notes: [
      {
        kind: 'new',
        text: 'Flak shells are now true artillery: lobbed on a parabolic arc with a fuse timed for where the target will be (plus the proximity trigger en route). Bursts erupt as rolling balls of black smoke with a white-hot flash at the core — sustained fire builds a drifting wall of it.',
      },
      {
        kind: 'fix',
        text: 'Your chosen game speed (×2, ×5) now sticks between rounds and reloads instead of resetting to ×1 every run.',
      },
      {
        kind: 'balance',
        text: 'The thermal lance now ignites directly on its target and sweeps onward at that distance — no more beam flailing out to maximum range past everything.',
      },
      {
        kind: 'balance',
        text: 'Cloud Seeding earns its name: the jet now trails a dense contrail of fresh clouds behind it (a drop every ~0.3s, faster with ranks) and the cloud cap grows +5 per rank, so a strafing pass paints a real weather front.',
      },
      {
        kind: 'balance',
        text: 'Static Mines is now Magnetic Mines: instead of zapping (which was Storm Front with extra steps), armed mines project a magnetic field that drags nearby invaders into their blast radius. Mines themselves hold station again — the balloons just rise and wait.',
      },
      {
        kind: 'balance',
        text: 'Lock Down freezes last much longer: 4s base (up from 2.5s) and +0.7s per rank.',
      },
      {
        kind: 'fix',
        text: 'Glassed Sky now shows its work: the strike zone stays visibly molten, shimmering orange with embers boiling off while everything inside burns.',
      },
      {
        kind: 'balance',
        text: 'Salvage Protocol was out-flakking the flak gun — consumed hosts now burst into a smaller ring of weaker fragments. In exchange, the Flak Gun itself got hotter: 6 base fragments (up from 5) at 60% damage each (up from 55%).',
      },
      {
        kind: 'balance',
        text: 'Overcharge Core no longer starts runs half charged (it was a one-shot gimmick) — instead it charges +40% faster and surges +40% harder, all run long.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'Field Notes',
    blurb: 'The synergy glossary learns what you are carrying.',
    notes: [
      {
        kind: 'new',
        text: 'During a run, the synergy glossary now highlights your arsenal: synergies you own glow green, ones that can appear in offers right now glow and pulse, and every parent shows your live progress toward its tier (★1/2).',
      },
      {
        kind: 'new',
        text: 'The glossary is also browsable from the home screen, next to the patch notes.',
      },
      {
        kind: 'fix',
        text: 'The paragon board breathes again: nodes are spread out so neighboring branches no longer overlap, and every unique node now has its own icon (🔩 Hardened Slugs, 🛡️ Aegis Protocol, 🏦 Compound Interest…) so you can read the board without hovering. Name labels are gone — the icons carry the board, with full details on hover or tap.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'Sharper Teeth',
    blurb: 'The opening fight gets fair, and everything hits more visibly.',
    notes: [
      {
        kind: 'balance',
        text: 'Nova Pulse now knocks invaders back on every pulse, no synergy required, and its shockwave reaches further (radius 240 → 320). Concussive Pulse stacks extra shove distance on top.',
      },
      {
        kind: 'balance',
        text: 'Flamethrower reach raised from 250 to 330 (and more per rank), so the cone actually meets the invaders.',
      },
      {
        kind: 'fix',
        text: 'The flamethrower is far more visible: a burning cone flashes over the whole hit area and the gout is denser, bigger, and brighter.',
      },
      {
        kind: 'fix',
        text: 'The thermal lance now shows where it stops: an impact splash marks the invader blocking the beam, and the beam recovers its length smoothly instead of flickering back to full range.',
      },
      {
        kind: 'fix',
        text: 'Damage numbers are bigger and outlined, so you can actually read them mid-fight.',
      },
      {
        kind: 'fix',
        text: 'The Mine Layer is now called Balloon Mines — it was always balloons.',
      },
      {
        kind: 'new',
        text: 'Synergy glossary: tap ⛓ during a run (it pauses the fight) or on any level-up screen to browse every synergy, its parent cards, and the tiers required.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'The Reactor Spoke',
    blurb: 'A seventh paragon branch, and the battlefield gets a battery.',
    notes: [
      {
        kind: 'new',
        text: 'The Reactor branch — a seventh spoke on the paragon board (🔋), crowned by the Capacitor Array keystone. Like the Aegis Protocol, it unlocks a whole new system: kills charge a battery (the amber bar under your XP), and at full charge every weapon surges with +25% damage while it discharges. Bosses dump a big chunk of charge on death.',
      },
      {
        kind: 'new',
        text: 'Passive earning: Dust Siphon nodes generate stardust for every minute of battle you survive, banked into the run reward.',
      },
      {
        kind: 'new',
        text: 'Interest: Compound Cell minors and the Compound Interest notable pay up to ~9% interest on unspent stardust at the end of every run — savers are rewarded for sitting on a bank.',
      },
      {
        kind: 'new',
        text: 'The Overcharge Core expansion starts every run half charged, with faster charging and harder surges.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'Priced by the Lab',
    blurb: 'The legendary expansion nodes now cost what they measure.',
    notes: [
      {
        kind: 'balance',
        text: 'We benchmarked the three expansion effects with a mid-game kit: an extra gun added ~68 DPS, a fourth weapon line ~90, and raising every weapon cap from ★5 to ★6 a whopping ~153. Prices now follow the data: weapon-tier nodes ✦4000, weapon-slot nodes ✦3400, extra-cannon nodes ✦3000 (cannons are great early, but prestige keeps adding guns anyway).',
      },
      {
        kind: 'new',
        text: 'Training range: a Guns row pins the cannon count (independent of presets), so weapon value can be measured per-gun.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'Sticker Shock',
    blurb: 'Prices now match power.',
    notes: [
      {
        kind: 'balance',
        text: 'Paragon node prices no longer creep up with every point you buy — what you see is what you pay, and the price now reflects the node, not when you bought it. Minors stay pocket change, notables cost about a good run, and the truly powerful nodes are a project: keystones run ✦2000 and the expansion nodes beyond them ✦3200–4000, several runs of stardust each. Tree resets still refund exactly what you spent.',
      },
      {
        kind: 'new',
        text: 'Paragon nodes now show their tier like cards do — node color matches card rarity (common, rare, epic, legendary) and an icon inside each node marks its family (⚔️ offense, 🧰 arsenal, ⚙️ tech, 🛡️ defense, 📡 sensors, 🎲 fortune).',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'The Bigger Picture',
    blurb: 'Complete the paragon board and see how wide the war really is.',
    notes: [
      {
        kind: 'new',
        text: 'Prestige: once every node on the paragon board is bought, the tree offers to pull the view back. Prestiging wipes your stardust and the board — but the camera zooms out permanently, revealing a wider front with one more gun emplacement. Up to ten guns can eventually hold the line.',
      },
      {
        kind: 'new',
        text: 'Prestige survives everything except a full progress wipe, travels with save codes, and shows on the home screen and tree header.',
      },
      {
        kind: 'new',
        text: 'Training range: a Prestige row simulates the zoomed-out battlefield for build testing.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'Hungry Balloons',
    blurb: 'Community report: cloud cover made minefields feel sluggish.',
    notes: [
      {
        kind: 'fix',
        text: 'Mines no longer wait politely while slowed invaders crawl just outside their trigger radius — armed mines now catch the wind and drift toward nearby prey. Minefields actively close the gap, clouds or not.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'Storm Front',
    blurb: 'Three new battlefield effects and fourteen new synergies.',
    notes: [
      {
        kind: 'new',
        text: 'New effect — Stun: lightning stops invaders dead for a moment. The Tesla Arc now stuns everything it strikes, and so does every other lightning source.',
      },
      {
        kind: 'new',
        text: 'New effect — Chill: cryo damage slows invaders to a crawl. Stacks with the slow from Cloud Cover.',
      },
      {
        kind: 'new',
        text: 'New effect — Knockback: some weapons now physically shove invaders. Motherships are too heavy to move.',
      },
      {
        kind: 'new',
        text: 'Thermal Shock (Lock Down × Flamethrower): igniting a frozen invader, or freezing a burning one, detonates both effects in a violent burst.',
      },
      {
        kind: 'new',
        text: 'Static Discharge (Tesla Arc × Flamethrower): the bolt jumps extra links for every affliction on its first target.',
      },
      {
        kind: 'new',
        text: 'EMP Discharge (BFG × Lock Down): the BFG blast flash-freezes every invader on screen.',
      },
      {
        kind: 'new',
        text: 'Arc Capacitor (BFG × Tesla Arc): after the blast, residual charge arcs stunning lightning into the survivors.',
      },
      {
        kind: 'new',
        text: 'Glassed Sky (Orbital Laser × Flamethrower): the strike leaves its impact zone burning.',
      },
      {
        kind: 'new',
        text: 'Target Uplink (Orbital Laser × Nanite Swarm): your drones double as spotters — faster locks, elites painted first.',
      },
      {
        kind: 'new',
        text: 'Refraction (Thermal Lance × Cloud Cover): a cloud refracts every lance shot into a second, weaker sweep.',
      },
      {
        kind: 'new',
        text: 'Overwatch (Thermal Lance × Lock Down): frozen invaders never block the beam and take bonus damage as it glasses through them.',
      },
      {
        kind: 'new',
        text: 'Concussive Pulse (Nova Pulse × Mine Layer): novas shove invaders away from the city — ideally into your minefield.',
      },
      {
        kind: 'new',
        text: 'Static Mines (Mine Layer × Tesla Arc): waiting mines crackle with charge, zapping and stunning anything that drifts near.',
      },
      {
        kind: 'new',
        text: 'Smokescreen (Mine Layer × Cloud Cover): detonating mines leave a slowing smoke bank at the blast site.',
      },
      {
        kind: 'new',
        text: 'Cryo Shells (Flak Gun × Lock Down): flak fragments chill whatever they strike.',
      },
      {
        kind: 'new',
        text: 'Salvage Protocol (Devourer Swarm × Flak Gun): a consumed host bursts into a ring of flak fragments.',
      },
      {
        kind: 'new',
        text: 'Momentum (Main Guns × Rocket Pod): every main-gun kill shaves time off the rocket cooldown.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'Playing with Fire',
    blurb: 'The flamethrower learns to leave a mark.',
    notes: [
      {
        kind: 'new',
        text: 'Burning: everything the flamethrower roasts is now set on fire, taking damage over three seconds. Re-igniting refreshes the burn, and the hottest flame wins.',
      },
      {
        kind: 'new',
        text: 'Incendiary Rounds (Main Guns × Flamethrower): your bullets set whatever they hit burning.',
      },
      {
        kind: 'new',
        text: 'Napalm Warheads (Rocket Pod × Flamethrower): rocket blasts soak the impact zone in burning fuel.',
      },
      {
        kind: 'new',
        text: 'Wildfire (Devourer Swarm × Flamethrower): when a burning invader dies, the fire leaps to everything nearby.',
      },
      {
        kind: 'new',
        text: 'Thermite Beam (Thermal Lance × Flamethrower): the lance leaves its targets burning after the sweep moves on.',
      },
      {
        kind: 'new',
        text: 'Every cannon now mounts its own Thermal Lance — extra guns mean extra sweeps. The BFG stays a single battlefield-wide charge, like the orbital cannon.',
      },
      {
        kind: 'balance',
        text: 'Thermal Lance no longer pierces: the beam stops at the first invader it touches. Invaders hiding directly behind another are safe from it.',
      },
    ],
  },
  {
    date: '2026-06-12',
    title: 'The Long Road',
    blurb: 'Paragon progression gets deeper, and the game behaves better on phones.',
    notes: [
      {
        kind: 'new',
        text: 'Paragon level: every tree node you buy raises the price of all future nodes by 5%. The header shows your level and the current price multiplier, and resetting the tree refunds exactly what you paid.',
      },
      {
        kind: 'balance',
        text: 'The Stardust Cache consolation card now pays out more the deeper your run goes, instead of a flat amount.',
      },
      {
        kind: 'fix',
        text: 'Audio now goes quiet when you switch apps or take a call, and comes back when you return. Your mute setting is respected either way.',
      },
      {
        kind: 'new',
        text: 'Training range: speed controls (×0.5 slow-motion up to ×5 fast-forward).',
      },
      {
        kind: 'fix',
        text: 'Mobile: the wave timer no longer hides under the buttons, the paragon board supports pinch-zoom (plus zoom buttons), and motherships always descend low enough for your guns to reach.',
      },
    ],
  },
  {
    date: '2026-06-11',
    title: 'First Contact',
    blurb: 'The invasion begins.',
    notes: [
      {
        kind: 'new',
        text: 'Last Horizon launches: hold the line through endless waves, with a mothership assault every tenth wave and elite invaders rolling random affixes.',
      },
      {
        kind: 'new',
        text: 'A full arsenal of weapons and synergy tactics, a paragon tree for permanent progression, and a training range for testing builds.',
      },
      {
        kind: 'new',
        text: 'Progress saves locally — export your save as a code to move it between devices, and reset everything from settings if you want a fresh start.',
      },
    ],
  },
]
