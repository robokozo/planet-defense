import type { RunStats, UpgradeRarity } from '@/game/types'

export const ARENA = {
  width: 1280,
  height: 720,
} as const

export const BATTERY = {
  radius: 26,
  shieldRadius: 44,
} as const

export const GROUND = {
  height: 56,
} as const

export const WAVES = {
  durationMs: 30_000,
  /** enemy hp multiplier applied per wave: hp * growth^(wave - 1) */
  hpGrowthPerWave: 1.16,
  speedGrowthPerWave: 1.02,
  initialSpawnIntervalMs: 1_500,
  spawnIntervalStepMs: 60,
  minSpawnIntervalMs: 220,
  eliteEveryNWaves: 5,
} as const

export const XP = {
  /** xp required for the next level: base * level^exponent */
  base: 12,
  exponent: 1.3,
} as const

export const STARDUST = {
  perKill: 0.25,
  perWave: 10,
  perLevel: 2,
} as const

export const NOVA = {
  maxRadius: 240,
  expandDurationMs: 450,
} as const

export const BULLET = {
  radius: 4,
} as const

export const BASE_RUN_STATS: RunStats = {
  damage: 10,
  cannonCount: 1,
  fireIntervalMs: 650,
  projectileCount: 1,
  projectileSpeed: 430,
  range: 480,
  pierce: 0,
  critChance: 0.05,
  critMultiplier: 2,
  maxHp: 100,
  regenPerSecond: 0,
  xpMultiplier: 1,
  luck: 1,
  weaponSlots: 3,
  weaponTierBonus: 0,
  novaIntervalMs: null,
  novaDamage: 40,
  aegisIntervalMs: null,
  flakLevel: 0,
  rocketLevel: 0,
  chainLevel: 0,
  cloudLevel: 0,
  lockdownLevel: 0,
  railgunLevel: 0,
  airstrikeLevel: 0,
  bfgLevel: 0,
  lanceLevel: 0,
  mineLevel: 0,
  orbitalLaserLevel: 0,
  stormLevel: 0,
  clusterLevel: 0,
  shatterLevel: 0,
  paintedLevel: 0,
  seedingLevel: 0,
  casLevel: 0,
  ionLevel: 0,
  stasisLevel: 0,
  capdumpLevel: 0,
  fabricatorLevel: 0,
  mirvLevel: 0,
  barrageLevel: 0,
  twinRailLevel: 0,
}

export const SYNERGIES = {
  /** lock down × orbital laser: faster locks, wider strikes, frozen targets prioritized */
  painted: {
    lockOnFactorBase: 0.75,
    lockOnFactorPerLevel: 0.05,
    radiusBonusBase: 0.15,
    radiusBonusPerLevel: 0.05,
  },
  /** cloud cover × strafing run: passes seed fresh clouds along the flight path */
  seeding: {
    dropIntervalMsBase: 1_000,
    dropIntervalStepMs: 120,
    extraCloudCap: 4,
  },
  /** rocket pod × strafing run: the jet launches rockets mid-pass */
  cas: {
    launchIntervalMsBase: 1_800,
    launchIntervalStepMs: 200,
  },
  /** tesla arc × rail gun: beams leave an ionized line that zaps crossers */
  ion: {
    durationMsBase: 2_000,
    durationMsPerLevel: 300,
    damageMultBase: 0.8,
    damageMultPerLevel: 0.3,
  },
  /** nova pulse × lock down: novas flash-freeze everything they hit */
  stasis: {
    freezeMsBase: 500,
    freezeMsPerLevel: 150,
  },
  /** bfg × nova pulse: firing the bfg dumps a boosted nova from every cannon */
  capdump: {
    novaDamageMultBase: 1.25,
    novaDamageMultPerLevel: 0.25,
  },
  /** nanite swarm × mine layer: drones manufacture extra mines */
  fabricators: {
    extraMinesPerDropPerLevel: 1,
    extraMaxActivePerLevel: 2,
  },
  /** rocket pod × mine layer: rocket blasts scatter armed mines */
  mirv: {
    minesPerBlastBase: 1,
    minesPerBlastPerLevel: 1,
    maxPerBlast: 6,
  },
  /** salvo targeting × flak gun: the flak gun engages extra targets per cycle */
  barrage: {
    extraTargetsPerLevel: 1,
  },
  /** salvo targeting × rail gun: extra beams at distinct targets */
  twinRail: {
    extraBeamsPerLevel: 1,
  },
} as const

/** proximity mines seeded into the sky */
export const MINES = {
  baseIntervalMs: 8_000,
  intervalStepMs: 700,
  minIntervalMs: 5_000,
  minesPerDrop: 3,
  minesPerDropPerLevel: 1,
  maxActive: 10,
  armDelayMs: 500,
  proximityPx: 30,
  blastRadius: 70,
  blastRadiusPerLevel: 6,
  /** mine damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 2.5,
  damageMultPerLevel: 0.8,
} as const

/** paints a reticle on the densest cluster, then fires a column from orbit */
export const ORBITAL_LASER = {
  baseIntervalMs: 14_000,
  intervalStepMs: 1_200,
  minIntervalMs: 9_000,
  lockOnMs: 800,
  strikeRadius: 90,
  strikeRadiusPerLevel: 8,
  /** strike damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 14,
  damageMultPerLevel: 5,
} as const

export const STORM_FRONT = {
  baseIntervalMs: 3_500,
  intervalStepMs: 300,
  minIntervalMs: 2_000,
  /** bolt damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 1.2,
  damageMultPerLevel: 0.5,
} as const

export const CLUSTER_BOMBS = {
  baseFragments: 5,
  fragmentsPerLevel: 2,
  /** fragment damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 0.35,
  damageMultPerLevel: 0.07,
  fragmentTravelPx: 130,
} as const

export const SHATTERPOINT = {
  /** frozen invaders take damage × (1 + baseBonus + bonusPerLevel × (level − 1)) */
  baseBonus: 0.5,
  bonusPerLevel: 0.25,
} as const

/** a beam anchored at the main cannon that sweeps an arc across the sky, colossus-style */
export const LANCE = {
  baseIntervalMs: 9_000,
  intervalStepMs: 800,
  minIntervalMs: 5_500,
  /** per-invader damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 3,
  damageMultPerLevel: 1,
  /** degrees of sky covered per sweep, centered on the densest cluster */
  sweepArcDegBase: 70,
  sweepArcDegPerLevel: 15,
  sweepSpeedDegPerSec: 80,
  beamHalfWidthPx: 9,
} as const

export const BOSS = {
  everyNWaves: 10,
  /** boss hp = base × hpGrowthPerWave^(wave − 1), sharing the normal wave curve */
  baseHp: 1_400,
  addSpawnIntervalMs: 4_000,
  xpGems: 6,
  xpPerGem: 35,
} as const

export const LOCKDOWN = {
  baseIntervalMs: 8_000,
  intervalStepMs: 700,
  minIntervalMs: 5_000,
  baseTargets: 3,
  targetsPerLevel: 2,
  baseFreezeMs: 2_500,
  freezeMsPerLevel: 400,
} as const

export const RAILGUN = {
  baseIntervalMs: 5_500,
  intervalStepMs: 600,
  minIntervalMs: 3_800,
  /** beam damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 4,
  damageMultPerLevel: 1.2,
  beamHalfWidthPx: 7,
} as const

export const AIRSTRIKE = {
  baseIntervalMs: 12_000,
  intervalStepMs: 800,
  minIntervalMs: 7_500,
  planeSpeedPxPerSec: 330,
  planeAltitudeY: 210,
  dropIntervalMs: 300,
  bombFuseMs: 650,
  bombFallSpeedPxPerSec: 130,
  /** bomb damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 1.5,
  damageMultPerLevel: 0.5,
  baseBlastRadius: 58,
  blastRadiusPerLevel: 6,
} as const

export const BFG = {
  baseIntervalMs: 22_000,
  intervalStepMs: 2_000,
  minIntervalMs: 15_000,
  /** hits every invader on screen: bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 12,
  damageMultPerLevel: 5,
} as const

/** active clouds slow invaders that fall through them */
export const CLOUD = {
  /** invader speed multiplier inside a cloud at level 1 */
  slowFactorBase: 0.6,
  slowFactorPerLevel: 0.05,
  slowFactorMin: 0.4,
  /** clouds added per stack beyond the first */
  cloudsPerStack: 2,
  maxClouds: 12,
  activeAlpha: 0.26,
} as const

export const NOVA_START_INTERVAL_MS = 5_000

export const AEGIS_BLOCK_INTERVAL_MS = 12_000

/**
 * Card rarity odds: weight = (base + perWave × (wave − 1)) × luck (luck only
 * boosts rare and epic). Epic cards are near-impossible in wave 1 and grow
 * steadily more common as the run progresses.
 */
export const RARITY_WEIGHTS: Record<UpgradeRarity, { base: number; perWave: number }> = {
  common: { base: 100, perWave: 0 },
  rare: { base: 18, perWave: 7 },
  epic: { base: 3, perWave: 3 },
  legendary: { base: 1, perWave: 1.2 },
}

/** a dedicated flak gun: lobs proximity-fused shells that burst into short-lived fragments */
export const FLAK = {
  baseIntervalMs: 3_200,
  intervalStepMs: 350,
  minIntervalMs: 2_200,
  /** detonate when within enemy radius + this many px */
  fuseDistancePx: 26,
  baseFragments: 5,
  fragmentsPerLevel: 2,
  /** each fragment deals this percent of base bullet damage */
  baseDamagePercent: 55,
  damagePercentPerLevel: 5,
  fragmentTravelPx: 150,
  fragmentSpeedFactor: 0.75,
  /** shell flight speed relative to bullet speed */
  shellSpeedFactor: 0.85,
  /** the timed fuse bursts this far past the predicted intercept point */
  fuseOvershootPx: 30,
} as const

export const ROCKET = {
  baseIntervalMs: 6_500,
  intervalStepMs: 800,
  minIntervalMs: 3_200,
  /** rocket damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 4,
  damageMultPerLevel: 2,
  baseRadius: 90,
  radiusPerLevel: 12,
  speed: 300,
} as const

export const CHAIN = {
  baseIntervalMs: 4_500,
  intervalStepMs: 350,
  minIntervalMs: 2_400,
  /** chain damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 1.5,
  damageMultPerLevel: 0.6,
  baseChains: 3,
  chainsPerLevel: 1,
  jumpRadius: 190,
} as const
