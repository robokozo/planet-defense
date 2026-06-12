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
    title: 'The Reactor Spoke',
    blurb: 'A seventh paragon branch, and the battlefield gets a battery.',
    notes: [
      {
        kind: 'new',
        text: 'The Reactor branch — a seventh spoke on the paragon board (🔋), crowned by the Capacitor Array keystone. Like the Aegis Protocol, it unlocks a whole new system: kills charge a battery (the amber bar under your XP), and at full charge every weapon surges with +25% damage while it discharges. Bosses dump a big chunk of charge on death.',
      },
      {
        kind: 'new',
        text: 'Charge Coils minors speed up the capacitor, and the Overcharge Core expansion starts every run half charged with harder surges.',
      },
      {
        kind: 'new',
        text: 'Passive earning: Trickle Cell nodes generate stardust per real-world hour, banked whenever you return to the home screen (up to 12 hours accrue while away).',
      },
      {
        kind: 'new',
        text: 'Compound Interest notable: unspent stardust earns 5% interest at the end of every run — savers are rewarded for sitting on a bank.',
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
