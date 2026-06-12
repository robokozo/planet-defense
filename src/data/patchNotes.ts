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
