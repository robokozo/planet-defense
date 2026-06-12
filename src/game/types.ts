export interface RunStats {
  damage: number
  /** number of deployed cannons, each running its own fire cooldown */
  cannonCount: number
  fireIntervalMs: number
  projectileCount: number
  projectileSpeed: number
  /** max distance in px a projectile travels; the turret holds fire until an enemy is inside it */
  range: number
  pierce: number
  critChance: number
  critMultiplier: number
  maxHp: number
  regenPerSecond: number
  xpMultiplier: number
  /** multiplier on the odds of rare/epic level-up cards (1 = base odds) */
  luck: number
  /** how many distinct weapon types can be carried at once */
  weaponSlots: number
  /** extra max tiers granted to every weapon card by the paragon tree */
  weaponTierBonus: number
  /** multiplier on every auxiliary weapon cooldown — fire-rate bonuses are global haste */
  weaponCooldownFactor: number
  /** card rerolls available per run (base 1, raised by paragon reroll nodes) */
  rerollsPerRun: number
  /** card banishes available per run — base 0, only paragon nodes grant them */
  banishesPerRun: number
  /** null means novas are not unlocked for this run */
  novaIntervalMs: number | null
  novaDamage: number
  /** null means the aegis shield is not unlocked; otherwise ms between blocked impacts */
  aegisIntervalMs: number | null
  /** 0 means the weapon is not unlocked for this run */
  flakLevel: number
  flameLevel: number
  devourerLevel: number
  rocketLevel: number
  chainLevel: number
  cloudLevel: number
  lockdownLevel: number
  railgunLevel: number
  airstrikeLevel: number
  bfgLevel: number
  lanceLevel: number
  mineLevel: number
  orbitalLaserLevel: number
  /** synergy tactics — only offered once both parent weapons are ranked up */
  stormLevel: number
  clusterLevel: number
  shatterLevel: number
  paintedLevel: number
  seedingLevel: number
  casLevel: number
  ionLevel: number
  stasisLevel: number
  capdumpLevel: number
  fabricatorLevel: number
  mirvLevel: number
  barrageLevel: number
  twinRailLevel: number
  mitosisLevel: number
  incendiaryLevel: number
  napalmLevel: number
  wildfireLevel: number
  thermiteLevel: number
  thermalShockLevel: number
  dischargeLevel: number
  empLevel: number
  arcCapLevel: number
  glassedLevel: number
  uplinkLevel: number
  refractionLevel: number
  overwatchLevel: number
  concussiveLevel: number
  staticMinesLevel: number
  smokescreenLevel: number
  cryoLevel: number
  salvageLevel: number
  momentumLevel: number
}

export type UpgradeRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type UpgradeCategory = 'weapon' | 'tactic'

export interface HudSnapshot {
  hp: number
  maxHp: number
  level: number
  xp: number
  xpToNext: number
  wave: number
  kills: number
  elapsedMs: number
  /** null unless a mothership is on the field */
  boss: { hp: number; maxHp: number } | null
}

export interface UpgradeChoice {
  id: string
  name: string
  description: string
  rarity: UpgradeRarity
  category: UpgradeCategory
  currentStacks: number
  maxStacks: number
  /** for synergy tactics: the parent cards, e.g. "Tesla Arc ★2 + Cloud Cover ★2" */
  synergyOf: string | null
}

export interface LevelUpOffer {
  level: number
  choices: Array<UpgradeChoice>
  weaponSlotsUsed: number
  weaponSlotsTotal: number
  /** rerolls remaining for the whole run */
  rerollsLeft: number
  /** banishes remaining for the whole run */
  banishesLeft: number
}

export interface RunResult {
  waveReached: number
  kills: number
  level: number
  elapsedMs: number
  stardustEarned: number
  /** per-weapon damage totals for the run summary, sorted descending */
  damageBySource: Array<{ source: string; total: number }>
}

export interface SandboxStatsEntry {
  source: string
  total: number
  dps: number
}

export interface SandboxLayout {
  /** 'field' = rows of targets, 'boss' = one big single target */
  formation: 'field' | 'boss'
  /** 1 = default spacing; lower packs the dummies tighter */
  spread: number
  /** dummies patrol side to side on a sine, with honest velocity for intercepts */
  isMoving: boolean
  /** false silences the main cannons, isolating whatever ability is being tested */
  isMainGunEnabled: boolean
  /** dummy hit points; null = invincible. Finite dummies die and respawn, for testing kill-triggered effects */
  dummyHp: number | null
}

export interface GameSceneData {
  startingStats: RunStats
  stardustMultiplier: number
  /** 'sandbox' spawns invincible dummies, disables waves, and reports per-weapon dps */
  mode?: 'normal' | 'sandbox'
  /** sandbox only: pre-applied card stacks so visuals (drones, clouds…) match */
  initialCardStacks?: Record<string, number>
  sandboxLayout?: SandboxLayout
}
