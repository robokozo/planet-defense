import type { RunStats, UpgradeRarity } from '@/game/types'

export const ARENA = {
  width: 1280,
  height: 720,
  /** used instead when the host container is taller than wide (mobile portrait) */
  portraitWidth: 720,
  portraitHeight: 1280,
} as const

/**
 * Prestige: completing the paragon board lets you reset everything for a
 * permanent zoom-out — the view pulls back to a wider front with one more
 * gun emplacement per prestige.
 */
export const PRESTIGE = {
  bonusCannonsPerLevel: 1,
  /** hard cap — also the number of cannon slots the battlefield provides */
  maxCannons: 10,
  /** the logical arena grows by this fraction per prestige; FIT scaling shows it all */
  zoomOutPerLevel: 0.09,
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

/**
 * The capacitor: kills charge a battery; at full charge every weapon surges
 * (bonus damage) while it discharges, then charging starts over. The reactor
 * paragon branch improves charge rate, surge strength, and duration.
 */
export const CAPACITOR = {
  /** fraction of the battery one kill fills, before charge-rate bonuses */
  chargePerKill: 0.02,
  /** bosses dump a chunk of charge on death */
  bossKillBonus: 0.2,
} as const

/** passive stardust accrues while away, but only up to this many hours bank up */
export const PASSIVE_EARNING_CAP_HOURS = 12

export const NOVA = {
  maxRadius: 240,
  expandDurationMs: 450,
} as const

export const SALVO = {
  /** volley shots beyond the first deal this fraction of full damage */
  extraShotDamageFactor: 0.6,
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
  weaponCooldownFactor: 1,
  rerollsPerRun: 1,
  banishesPerRun: 0,
  capacitorChargeRate: 1,
  surgeDamageBonus: 0.25,
  surgeDurationMs: 6_000,
  capacitorStartFraction: 0,
  novaIntervalMs: null,
  novaDamage: 40,
  aegisIntervalMs: null,
  flakLevel: 0,
  flameLevel: 0,
  devourerLevel: 0,
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
  mitosisLevel: 0,
  incendiaryLevel: 0,
  napalmLevel: 0,
  wildfireLevel: 0,
  thermiteLevel: 0,
  thermalShockLevel: 0,
  dischargeLevel: 0,
  empLevel: 0,
  arcCapLevel: 0,
  glassedLevel: 0,
  uplinkLevel: 0,
  refractionLevel: 0,
  overwatchLevel: 0,
  concussiveLevel: 0,
  staticMinesLevel: 0,
  smokescreenLevel: 0,
  cryoLevel: 0,
  salvageLevel: 0,
  momentumLevel: 0,
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
  /** flamethrower × main guns: bullets ignite whatever they hit; burn dps = bullet damage × mult */
  incendiary: {
    burnDpsMultBase: 0.35,
    burnDpsMultPerLevel: 0.15,
  },
  /** flamethrower × rocket pod: blasts soak the zone in burning fuel; burn dps = bullet damage × mult */
  napalm: {
    burnDpsMultBase: 0.6,
    burnDpsMultPerLevel: 0.25,
  },
  /** flamethrower × devourer: when a burning invader dies, its fire leaps to neighbors */
  wildfire: {
    spreadRadiusBase: 90,
    spreadRadiusPerLevel: 20,
  },
  /** flamethrower × thermal lance: the beam ignites everything it sears; burn dps = bullet damage × mult */
  thermite: {
    burnDpsMultBase: 0.8,
    burnDpsMultPerLevel: 0.3,
  },
  /** lock down × flamethrower: opposing statuses detonate, consuming both */
  thermalshock: {
    /** burst damage = bullet damage × (burstDamageMultBase + burstDamageMultPerLevel × (level − 1)) */
    burstDamageMultBase: 2,
    burstDamageMultPerLevel: 1,
  },
  /** tesla arc × flamethrower: the bolt jumps extra links per status afflicting its anchor */
  discharge: {
    linksPerStatusPerLevel: 1,
  },
  /** bfg × lock down: the discharge doubles as an EMP, flash-freezing the field */
  emp: {
    freezeMsBase: 800,
    freezeMsPerLevel: 250,
  },
  /** bfg × tesla arc: residual charge arcs lightning into survivors after the discharge */
  arccap: {
    boltsBase: 3,
    boltsPerLevel: 2,
    damageMultBase: 1,
    damageMultPerLevel: 0.4,
  },
  /** orbital laser × flamethrower: the strike leaves its blast zone burning */
  glassed: {
    burnDpsMultBase: 1,
    burnDpsMultPerLevel: 0.4,
  },
  /** orbital laser × nanite: drone spotters — faster locks, elites painted first */
  uplink: {
    lockOnFactorBase: 0.7,
    lockOnFactorPerLevel: 0.06,
  },
  /** thermal lance × cloud cover: a cloud refracts a second, weaker sweep */
  refraction: {
    damageFactorBase: 0.5,
    damageFactorPerLevel: 0.1,
    arcFactor: 0.6,
  },
  /** thermal lance × lock down: frozen invaders don't block the beam and take bonus damage */
  overwatch: {
    frozenDamageBonusBase: 0.25,
    frozenDamageBonusPerLevel: 0.25,
  },
  /** nova pulse × mine layer: the pulse shoves invaders away from the city */
  concussive: {
    knockbackPxBase: 70,
    knockbackPxPerLevel: 30,
  },
  /** mine layer × tesla arc: waiting mines zap and stun whatever drifts close */
  staticmines: {
    zapIntervalMs: 900,
    zapRadiusPx: 90,
    damageMultBase: 0.5,
    damageMultPerLevel: 0.25,
  },
  /** mine layer × cloud cover: detonations leave a slowing smoke bank */
  smokescreen: {
    extraCloudCapPerLevel: 2,
  },
  /** flak × lock down: fragments chill what they strike */
  cryoshells: {
    chillMsBase: 1_200,
    chillMsPerLevel: 400,
    chillSlowFactor: 0.65,
  },
  /** devourer × flak: a consumed host bursts into a ring of flak fragments */
  salvage: {
    fragmentsBase: 6,
    fragmentsPerLevel: 2,
    damageMultBase: 0.4,
    damageMultPerLevel: 0.15,
  },
  /** salvo × rocket pod: main-gun kills shave time off the rocket cooldown */
  momentum: {
    cooldownRefundMsBase: 150,
    cooldownRefundMsPerLevel: 75,
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
  /** devourer swarm × nanite swarm: a dying host splits the payload in two,
   * each child carrying the FULL remaining budget */
  mitosis: {
    splitCount: 2,
    /** leap radius multiplier: 1 + perLevel × (level − 1) beyond the base */
    leapRadiusBonusPerLevel: 0.25,
  },
} as const

/**
 * Devourer Swarm: a payload of nanites with a fixed damage budget. It eats
 * its host alive; whatever budget remains when the host dies leaps whole to
 * the next host in range, until the budget is spent or nothing is in reach.
 */
export const DEVOURER = {
  baseIntervalMs: 6_500,
  intervalStepMs: 600,
  minIntervalMs: 4_000,
  /** total payload budget = bullet damage × (baseBudgetMult + budgetMultPerLevel × (level − 1)) */
  baseBudgetMult: 6,
  budgetMultPerLevel: 3,
  /** drain speed = bullet damage × (baseDrainMult + drainMultPerLevel × (level − 1)) per second */
  baseDrainMult: 2,
  drainMultPerLevel: 0.75,
  /** how far the swarm can leap to a new host */
  leapRadiusPx: 150,
  leapRadiusPerLevel: 25,
  projectileSpeed: 380,
  /** runaway-mitosis guard: above this many live swarms, splits become single leaps */
  maxActiveSwarms: 36,
} as const

/** proximity mines: every cannon lobs its own volley, held aloft on balloons */
export const MINES = {
  baseIntervalMs: 8_000,
  intervalStepMs: 700,
  minIntervalMs: 5_000,
  /** mines per volley = floor(minesPerDrop + minesPerDropPerLevel × (level − 1)) */
  minesPerDrop: 1,
  minesPerDropPerLevel: 0.5,
  /** active-mine ceiling scales with deployed cannons */
  maxActivePerCannon: 6,
  armDelayMs: 500,
  proximityPx: 30,
  /** armed mines catch the wind toward prey inside this radius, so slowed invaders can't stall the field */
  seekRadiusPx: 150,
  seekSpeedPxPerSec: 30,
  blastRadius: 85,
  blastRadiusPerLevel: 8,
  /** mine damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 2.5,
  damageMultPerLevel: 1.2,
} as const

/** paints a reticle on the densest cluster, then fires a column from orbit */
export const ORBITAL_LASER = {
  baseIntervalMs: 14_000,
  intervalStepMs: 1_200,
  minIntervalMs: 9_000,
  lockOnMs: 800,
  strikeRadius: 90,
  strikeRadiusPerLevel: 12,
  /** strike damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 16,
  damageMultPerLevel: 8,
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
  sweepSpeedDegPerSec: 65,
  beamHalfWidthPx: 7,
} as const

export const BOSS = {
  everyNWaves: 10,
  /** boss hp = base × hpGrowthPerWave^(wave − 1), sharing the normal wave curve */
  baseHp: 1_400,
  addSpawnIntervalMs: 4_000,
  xpGems: 6,
  xpPerGem: 35,
  /** minimum hover altitude — the scene lowers the hover line on tall portrait arenas so the guns can always reach the boss */
  hoverY: 170,
  driftSpeedPxPerSec: 30,
  /** plasma bolts dropped at the city while hovering */
  boltIntervalMs: 2_600,
  boltSpeedPxPerSec: 180,
  boltIntegrityDamage: 7,
} as const

/** flamethrower: short-range cone bursts from every cannon */
export const FLAME = {
  baseIntervalMs: 2_200,
  intervalStepMs: 180,
  minIntervalMs: 1_300,
  rangePx: 250,
  rangePerLevel: 18,
  coneHalfAngleRad: 0.42,
  /** per-burst damage to everything in the cone = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 1.1,
  damageMultPerLevel: 0.45,
  /** every cone hit also ignites: burn dps = bullet damage × (burnDpsMultBase + burnDpsMultPerLevel × (level − 1)) */
  burnDpsMultBase: 0.4,
  burnDpsMultPerLevel: 0.15,
  /** re-igniting refreshes this; the strongest dps wins, burns never stack */
  burnDurationMs: 3_000,
  /** burn damage lands in chunks this far apart so popups stay readable */
  burnTickMs: 500,
} as const

/** passive enemy behaviors that tick on a shared accumulator */
export const ENEMY_AURAS = {
  /** menders heal nearby invaders for a fraction of their max hp */
  menderIntervalMs: 1_500,
  menderRadiusPx: 140,
  menderHealFraction: 0.08,
  /** regenerating elites recover this fraction of max hp per second */
  eliteRegenFractionPerSec: 0.02,
} as const

export const ELITE_AFFIXES = {
  swift: { speedMult: 1.7, hpMult: 0.7, tint: 0xfde047 },
  regen: { tint: 0x86efac },
  split: { shardlings: 4, tint: 0xf9a8d4 },
} as const

/** a stasis missile: on contact a pulse emanates and freezes everything it touches */
export const LOCKDOWN = {
  baseIntervalMs: 8_000,
  intervalStepMs: 700,
  minIntervalMs: 5_000,
  missileSpeedPxPerSec: 340,
  pulseRadius: 95,
  pulseRadiusPerLevel: 24,
  baseFreezeMs: 2_500,
  freezeMsPerLevel: 400,
} as const

export const RAILGUN = {
  baseIntervalMs: 5_500,
  intervalStepMs: 600,
  minIntervalMs: 3_800,
  /** beam damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 5,
  damageMultPerLevel: 2,
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
  damageMultPerLevel: 0.4,
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

/** generic consolation cards offered when the real card pool runs dry */
export const FILLER_REWARDS = {
  /** stardust cache pays base + perWave × current wave, so late-run picks stay worth taking */
  stardustBase: 5,
  stardustPerWave: 1,
  repairIntegrity: 25,
  damagePercent: 5,
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
  intervalStepMs: 250,
  minIntervalMs: 2_400,
  /** chain damage = bullet damage × (baseDamageMult + damageMultPerLevel × (level − 1)) */
  baseDamageMult: 1.5,
  damageMultPerLevel: 0.35,
  baseChains: 3,
  chainsPerLevel: 1,
  jumpRadius: 190,
  /** lightning stuns: everything struck stops dead for this long */
  stunMsBase: 250,
  stunMsPerLevel: 50,
} as const
