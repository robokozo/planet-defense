import { FILLER_REWARDS, NOVA_START_INTERVAL_MS, RARITY_WEIGHTS } from '@/game/data/balance'
import type { RunStats, UpgradeCategory, UpgradeChoice, UpgradeRarity } from '@/game/types'

export interface UpgradeDefinition {
  id: string
  name: string
  description: string
  rarity: UpgradeRarity
  /** weapons compete for limited weapon slots; tactics never do */
  category: UpgradeCategory
  /** base tier cap — every card has 5; paragon tier nodes can raise weapon caps */
  maxStacks: number
  /** synergy gate: only offered once every listed card is at the listed tier */
  requires?: Array<{ id: string; stacks: number }>
  apply: (stats: RunStats) => RunStats
}

const BASE_MAX_STACKS = 5

/**
 * In-run picks change how you fight — new weapons and behaviors.
 * Flat stat growth lives in the paragon tree instead.
 */
export const UPGRADE_DEFINITIONS: Array<UpgradeDefinition> = [
  {
    id: 'salvo',
    name: 'Salvo Targeting',
    description:
      'A fire-control computer: each volley intercepts +1 separate invader — the extra shots hit at 60% damage',
    rarity: 'epic',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, projectileCount: stats.projectileCount + 1 }),
  },
  {
    id: 'bfg',
    name: 'BFG',
    description:
      'Bolts the BFG onto the main cannon: a very long cooldown blast that devastates every invader on screen (stacks: stronger, faster)',
    rarity: 'legendary',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, bfgLevel: stats.bfgLevel + 1 }),
  },
  {
    id: 'lockdown',
    name: 'Lock Down',
    description:
      'Fires a stasis missile at the most threatening invader — on impact a pulse freezes everything it washes over (stacks: wider pulse, longer freeze)',
    rarity: 'epic',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, lockdownLevel: stats.lockdownLevel + 1 }),
  },
  {
    id: 'lance',
    name: 'Thermal Lance',
    description:
      'Every cannon mounts a lance that sweeps a stretch of sky, searing the first invader in its path (stacks: wider sweep, stronger, faster)',
    rarity: 'epic',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, lanceLevel: stats.lanceLevel + 1 }),
  },
  {
    id: 'railgun',
    name: 'Rail Gun',
    description:
      'Periodically fires a piercing beam through the lowest invader, hitting everything along the line (stacks: faster, stronger)',
    rarity: 'epic',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, railgunLevel: stats.railgunLevel + 1 }),
  },
  {
    id: 'airstrike',
    name: 'Strafing Run',
    description:
      'Calls an aircraft to strafe the sky, dropping short-fuse flak bombs (stacks: faster, bigger blasts)',
    rarity: 'rare',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, airstrikeLevel: stats.airstrikeLevel + 1 }),
  },
  {
    id: 'flak',
    name: 'Flak Gun',
    description:
      'Mounts a flak gun that lobs proximity shells, bursting into fragments near invaders (stacks: +2 fragments, faster)',
    rarity: 'common',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, flakLevel: stats.flakLevel + 1 }),
  },
  {
    id: 'flame',
    name: 'Flamethrower',
    description:
      'Mounts a flamethrower: short-range cone bursts that roast everything in front of the cannon (stacks: faster, hotter, longer reach)',
    rarity: 'common',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, flameLevel: stats.flameLevel + 1 }),
  },
  {
    id: 'rocket',
    name: 'Rocket Pod',
    description:
      'Periodically launches a rocket at the densest invader cluster — big area blast (stacks: faster, stronger, wider)',
    rarity: 'rare',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, rocketLevel: stats.rocketLevel + 1 }),
  },
  {
    id: 'devourer',
    name: 'Devourer Swarm',
    description:
      'Fires a payload of hungry nanites with a fixed damage budget — when the host dies, the leftovers leap whole to the next victim (stacks: bigger payload, faster drain, longer leaps)',
    rarity: 'rare',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, devourerLevel: stats.devourerLevel + 1 }),
  },
  {
    id: 'chain',
    name: 'Tesla Arc',
    description: 'Periodically arcs lightning between invaders (stacks: more jumps, more damage)',
    rarity: 'rare',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, chainLevel: stats.chainLevel + 1 }),
  },
  {
    id: 'nova',
    name: 'Nova Pulse',
    description: 'Unlock a periodic shockwave (or pulse 12% faster, +15 damage)',
    rarity: 'rare',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => {
      if (stats.novaIntervalMs === null) {
        return { ...stats, novaIntervalMs: NOVA_START_INTERVAL_MS }
      }
      return {
        ...stats,
        novaIntervalMs: stats.novaIntervalMs / 1.12,
        novaDamage: stats.novaDamage + 15,
      }
    },
  },
  {
    id: 'cloud',
    name: 'Cloud Cover',
    description:
      'Seed the sky: invaders falling through clouds are slowed (stacks: more clouds, stronger slow)',
    rarity: 'rare',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, cloudLevel: stats.cloudLevel + 1 }),
  },
  {
    id: 'nanite',
    name: 'Nanite Swarm',
    description:
      'Repair drones tend the city: +1 integrity regenerated per second (stacks: more drones)',
    rarity: 'common',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, regenPerSecond: stats.regenPerSecond + 1 }),
  },
  {
    id: 'mines',
    name: 'Mine Layer',
    description:
      'Every cannon lobs balloon-tethered proximity mines into the sky, where they hang until something drifts too close (stacks: more mines per volley, bigger blasts)',
    rarity: 'rare',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, mineLevel: stats.mineLevel + 1 }),
  },
  {
    id: 'orbital-laser',
    name: 'Orbital Laser',
    description:
      'Paints the densest cluster, then a column of annihilation fires from orbit (stacks: faster, stronger, wider)',
    rarity: 'legendary',
    category: 'weapon',
    maxStacks: BASE_MAX_STACKS,
    apply: (stats) => ({ ...stats, orbitalLaserLevel: stats.orbitalLaserLevel + 1 }),
  },
  {
    id: 'storm',
    name: 'Storm Front',
    description:
      'Synergy: your clouds discharge lightning at invaders sheltering inside them (stacks: faster, stronger)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'chain', stacks: 2 },
      { id: 'cloud', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, stormLevel: stats.stormLevel + 1 }),
  },
  {
    id: 'cluster',
    name: 'Cluster Bombs',
    description:
      'Synergy: strafing-run bombs burst into flak fragments on detonation (stacks: more fragments)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'airstrike', stacks: 2 },
      { id: 'flak', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, clusterLevel: stats.clusterLevel + 1 }),
  },
  {
    id: 'shatter',
    name: 'Shatterpoint',
    description: 'Synergy: frozen invaders take +50% damage from all sources (stacks: +25% more)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'lockdown', stacks: 2 },
      { id: 'railgun', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, shatterLevel: stats.shatterLevel + 1 }),
  },
  {
    id: 'painted',
    name: 'Painted Target',
    description:
      'Synergy: the orbital laser prioritizes frozen clusters, locking faster with a wider strike (stacks: faster, wider)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'lockdown', stacks: 2 },
      { id: 'orbital-laser', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, paintedLevel: stats.paintedLevel + 1 }),
  },
  {
    id: 'seeding',
    name: 'Cloud Seeding',
    description:
      'Synergy: strafing runs seed fresh clouds along their flight path (stacks: seeds faster)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'cloud', stacks: 2 },
      { id: 'airstrike', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, seedingLevel: stats.seedingLevel + 1 }),
  },
  {
    id: 'cas',
    name: 'Close Air Support',
    description:
      'Synergy: the strafing jet also launches rockets at the densest cluster mid-pass (stacks: more rockets)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'rocket', stacks: 2 },
      { id: 'airstrike', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, casLevel: stats.casLevel + 1 }),
  },
  {
    id: 'ion',
    name: 'Ion Rail',
    description:
      'Synergy: rail beams leave an ionized line that zaps invaders crossing it (stacks: longer, stronger)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'chain', stacks: 2 },
      { id: 'railgun', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, ionLevel: stats.ionLevel + 1 }),
  },
  {
    id: 'stasis',
    name: 'Stasis Wave',
    description: 'Synergy: nova pulses flash-freeze every invader they hit (stacks: longer freeze)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'nova', stacks: 2 },
      { id: 'lockdown', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, stasisLevel: stats.stasisLevel + 1 }),
  },
  {
    id: 'capdump',
    name: 'Capacitor Dump',
    description:
      'Synergy: firing the BFG discharges a boosted nova from every cannon (stacks: stronger novas)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'bfg', stacks: 2 },
      { id: 'nova', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, capdumpLevel: stats.capdumpLevel + 1 }),
  },
  {
    id: 'fabricators',
    name: 'Auto-Fabricators',
    description:
      'Synergy: nanite drones manufacture munitions — +1 mine per deployment and +2 active mine cap (stacks)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'nanite', stacks: 2 },
      { id: 'mines', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, fabricatorLevel: stats.fabricatorLevel + 1 }),
  },
  {
    id: 'barrage',
    name: 'Flak Barrage',
    description:
      'Synergy: the fire-control computer slaves the flak gun — it lobs shells at extra targets every cycle (stacks: more targets)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'salvo', stacks: 2 },
      { id: 'flak', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, barrageLevel: stats.barrageLevel + 1 }),
  },
  {
    id: 'twinrail',
    name: 'Twin Rails',
    description:
      'Synergy: the fire-control computer splits the rail shot — extra beams strike separate targets (stacks: more beams)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'salvo', stacks: 2 },
      { id: 'railgun', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, twinRailLevel: stats.twinRailLevel + 1 }),
  },
  {
    id: 'mitosis',
    name: 'Mitosis',
    description:
      'Synergy: when a devoured host dies, the swarm divides — TWO payloads leap out, each carrying the full remaining budget, dividing again on every kill (stacks: longer leaps)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'devourer', stacks: 2 },
      { id: 'nanite', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, mitosisLevel: stats.mitosisLevel + 1 }),
  },
  {
    id: 'mirv',
    name: 'MIRV Warheads',
    description:
      'Synergy: rocket blasts scatter armed proximity mines across the impact zone (stacks: more mines)',
    rarity: 'epic',
    category: 'tactic',
    maxStacks: BASE_MAX_STACKS,
    requires: [
      { id: 'rocket', stacks: 2 },
      { id: 'mines', stacks: 2 },
    ],
    apply: (stats) => ({ ...stats, mirvLevel: stats.mirvLevel + 1 }),
  },
]

/**
 * Consolation picks padded into the offer when the real pool can't fill it —
 * always repeatable, applied by the scene rather than via stat stacks.
 */
export const FILLER_CHOICES: Array<UpgradeChoice> = [
  {
    id: 'filler-stardust',
    name: 'Stardust Cache',
    description: `Salvage crews sweep the battlefield: bank +${FILLER_REWARDS.stardust} stardust for this run immediately`,
    rarity: 'common',
    category: 'tactic',
    currentStacks: 0,
    maxStacks: 0,
    synergyOf: null,
  },
  {
    id: 'filler-repair',
    name: 'Field Repairs',
    description: `Work crews shore up the city: restore ${FILLER_REWARDS.repairIntegrity} integrity now`,
    rarity: 'common',
    category: 'tactic',
    currentStacks: 0,
    maxStacks: 0,
    synergyOf: null,
  },
  {
    id: 'filler-overcharge',
    name: 'Ammo Overcharge',
    description: `Hotter propellant in every magazine: +${FILLER_REWARDS.damagePercent}% damage for the rest of the run`,
    rarity: 'common',
    category: 'tactic',
    currentStacks: 0,
    maxStacks: 0,
    synergyOf: null,
  },
]

export function isFillerUpgradeId({ upgradeId }: { upgradeId: string }): boolean {
  return FILLER_CHOICES.some((choice) => choice.id === upgradeId)
}

/** "Tesla Arc ★2 + Cloud Cover ★2" for synergy tactics, null for everything else */
export function describeSynergyRequirements({
  definition,
}: {
  definition: UpgradeDefinition
}): string | null {
  if (definition.requires === undefined) {
    return null
  }
  return definition.requires
    .map((requirement) => {
      const parent = UPGRADE_DEFINITIONS.find((candidate) => candidate.id === requirement.id)
      return `${parent?.name ?? requirement.id} ★${requirement.stacks}`
    })
    .join(' + ')
}

/** paragon tier nodes only raise the caps of weapons, not tactics */
function effectiveMaxStacks({
  definition,
  weaponTierBonus,
}: {
  definition: UpgradeDefinition
  weaponTierBonus: number
}): number {
  if (definition.category === 'weapon') {
    return definition.maxStacks + weaponTierBonus
  }
  return definition.maxStacks
}

function rarityWeight({
  rarity,
  wave,
  luck,
}: {
  rarity: UpgradeRarity
  wave: number
  luck: number
}): number {
  const { base, perWave } = RARITY_WEIGHTS[rarity]
  const waveScaled = base + perWave * (wave - 1)
  return rarity === 'common' ? waveScaled : waveScaled * luck
}

export function countOwnedWeapons({ stacks }: { stacks: Map<string, number> }): number {
  return UPGRADE_DEFINITIONS.filter(
    (definition) => definition.category === 'weapon' && (stacks.get(definition.id) ?? 0) > 0,
  ).length
}

export function rollUpgradeChoices({
  stacks,
  roll,
  count,
  wave,
  luck,
  weaponSlots,
  weaponTierBonus,
  banished,
}: {
  stacks: Map<string, number>
  /** random number generator returning values in [0, 1) */
  roll: () => number
  count: number
  wave: number
  luck: number
  weaponSlots: number
  weaponTierBonus: number
  /** card ids struck from this run's pool by the banish mechanic */
  banished?: Set<string>
}): Array<UpgradeChoice> {
  const hasFreeSlot = countOwnedWeapons({ stacks }) < weaponSlots
  const eligible = UPGRADE_DEFINITIONS.filter((definition) => {
    if (banished?.has(definition.id) === true) {
      return false
    }
    const currentStacks = stacks.get(definition.id) ?? 0
    if (currentStacks >= effectiveMaxStacks({ definition, weaponTierBonus })) {
      return false
    }
    const isNewWeapon = definition.category === 'weapon' && currentStacks === 0
    if (isNewWeapon === true && hasFreeSlot === false) {
      return false
    }
    if (definition.requires !== undefined) {
      const isUnlocked = definition.requires.every(
        (requirement) => (stacks.get(requirement.id) ?? 0) >= requirement.stacks,
      )
      if (isUnlocked === false) {
        return false
      }
    }
    return true
  })

  // weighted sample without replacement
  const remaining = [...eligible]
  const chosen: Array<UpgradeDefinition> = []
  while (chosen.length < count && remaining.length > 0) {
    const weights = remaining.map((definition) =>
      rarityWeight({ rarity: definition.rarity, wave, luck }),
    )
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    let cursor = roll() * totalWeight
    let pickedIndex = remaining.length - 1
    for (let index = 0; index < remaining.length; index += 1) {
      cursor -= weights[index]
      if (cursor < 0) {
        pickedIndex = index
        break
      }
    }
    chosen.push(remaining[pickedIndex])
    remaining.splice(pickedIndex, 1)
  }

  const choices: Array<UpgradeChoice> = chosen.map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    rarity: definition.rarity,
    category: definition.category,
    currentStacks: stacks.get(definition.id) ?? 0,
    maxStacks: effectiveMaxStacks({ definition, weaponTierBonus }),
    synergyOf: describeSynergyRequirements({ definition }),
  }))

  // the pool ran dry (everything maxed or gated) — pad with consolation picks
  for (const filler of FILLER_CHOICES) {
    if (choices.length >= count) {
      break
    }
    choices.push({ ...filler })
  }
  return choices
}

export function findUpgradeDefinition({
  upgradeId,
}: {
  upgradeId: string
}): UpgradeDefinition | null {
  const definition = UPGRADE_DEFINITIONS.find((candidate) => candidate.id === upgradeId)
  if (definition === undefined) {
    return null
  }
  return definition
}
