import { AEGIS_BLOCK_INTERVAL_MS, BASE_RUN_STATS, PRESTIGE } from '@/game/data/balance'
import type { RunStats, UpgradeRarity } from '@/game/types'

export type SkillNodeKind = 'root' | 'minor' | 'notable' | 'keystone'

export type SkillBranch =
  | 'core'
  | 'offense'
  | 'arsenal'
  | 'tech'
  | 'defense'
  | 'sensors'
  | 'fortune'
  | 'reactor'

export type MetaStat =
  | 'damagePercent'
  | 'fireRatePercent'
  | 'projectileSpeedPercent'
  | 'rangePercent'
  | 'critChancePercent'
  | 'pierceFlat'
  | 'maxHpFlat'
  | 'regenPerSecondFlat'
  | 'critMultiplierFlat'
  | 'aegisUnlockFlat'
  | 'weaponSlotFlat'
  | 'weaponTierFlat'
  | 'cannonFlat'
  | 'luckPercent'
  | 'xpPercent'
  | 'stardustPercent'
  | 'rerollFlat'
  | 'banishFlat'
  | 'capacitorChargePercent'
  | 'surgeDamagePercent'
  | 'surgeDurationMsFlat'
  | 'capacitorStartPercent'
  | 'passivePerHourFlat'
  | 'interestPercentFlat'

export interface SkillEffect {
  stat: MetaStat
  amount: number
}

export interface SkillNode {
  id: string
  name: string
  description: string
  kind: SkillNodeKind
  /** card-style tier — drives the node's color on the board, like card rarity */
  tier: UpgradeRarity
  branch: SkillBranch
  cost: number
  x: number
  y: number
  /** ids of nodes this node connects to (edges are bidirectional) */
  connections: Array<string>
  effects: Array<SkillEffect>
}

export const ROOT_NODE_ID = 'core'

/** expansions override this to legendary — they're the board's chase nodes */
const TIER_BY_KIND: Record<SkillNodeKind, UpgradeRarity> = {
  root: 'common',
  minor: 'common',
  notable: 'rare',
  keystone: 'epic',
}

// ── rotationally symmetric layout ─────────────────────────────────────
// Six branches at 60° intervals share one slot geometry; only the content
// differs per branch. Minors come in many small increments. Two rings link
// adjacent branches: an inner one at the early tier and an outer one at the
// late tier, so deep cross-branch pathing never has to return to the core.

type SlotKey =
  | 'entry'
  | 'earlyA'
  | 'earlyB'
  | 'earlyC'
  | 'midA'
  | 'midB'
  | 'midC'
  | 'midD'
  | 'notable'
  | 'lateA'
  | 'lateB'
  | 'lateC'
  | 'deepA'
  | 'deepB'
  | 'deepC'
  | 'primeA'
  | 'primeB'
  | 'keystone'

interface SlotLayout {
  radius: number
  angleOffsetDeg: number
  kind: SkillNodeKind
  cost: number
}

// price tiers track node power, not position: minors are pocket change so a
// run always buys something, while keystones and expansions cost several
// runs' worth of stardust — the real good nodes are earned, not stumbled into
const SLOT_LAYOUT: Record<SlotKey, SlotLayout> = {
  entry: { radius: 115, angleOffsetDeg: 0, kind: 'minor', cost: 30 },
  earlyA: { radius: 215, angleOffsetDeg: -20, kind: 'minor', cost: 40 },
  earlyB: { radius: 215, angleOffsetDeg: 0, kind: 'minor', cost: 40 },
  earlyC: { radius: 215, angleOffsetDeg: 20, kind: 'minor', cost: 40 },
  midA: { radius: 320, angleOffsetDeg: -26, kind: 'minor', cost: 50 },
  midB: { radius: 320, angleOffsetDeg: -9, kind: 'minor', cost: 50 },
  midC: { radius: 320, angleOffsetDeg: 9, kind: 'minor', cost: 50 },
  midD: { radius: 320, angleOffsetDeg: 26, kind: 'minor', cost: 50 },
  notable: { radius: 430, angleOffsetDeg: 0, kind: 'notable', cost: 400 },
  lateA: { radius: 540, angleOffsetDeg: -22, kind: 'minor', cost: 70 },
  lateB: { radius: 540, angleOffsetDeg: 0, kind: 'minor', cost: 70 },
  lateC: { radius: 540, angleOffsetDeg: 22, kind: 'minor', cost: 70 },
  deepA: { radius: 650, angleOffsetDeg: -14, kind: 'minor', cost: 90 },
  deepB: { radius: 650, angleOffsetDeg: 0, kind: 'minor', cost: 90 },
  deepC: { radius: 650, angleOffsetDeg: 14, kind: 'minor', cost: 90 },
  primeA: { radius: 745, angleOffsetDeg: -8, kind: 'minor', cost: 120 },
  primeB: { radius: 745, angleOffsetDeg: 8, kind: 'minor', cost: 120 },
  keystone: { radius: 840, angleOffsetDeg: 0, kind: 'keystone', cost: 2_000 },
}

const SLOT_CONNECTIONS: Record<SlotKey, Array<SlotKey>> = {
  entry: ['earlyA', 'earlyB', 'earlyC'],
  earlyA: ['midA', 'midB'],
  earlyB: ['midB', 'midC'],
  earlyC: ['midC', 'midD'],
  midA: ['notable'],
  midB: ['notable'],
  midC: ['notable'],
  midD: ['notable'],
  notable: ['lateA', 'lateB', 'lateC'],
  lateA: ['deepA'],
  lateB: ['deepB'],
  lateC: ['deepC'],
  deepA: ['primeA'],
  deepB: ['primeA', 'primeB'],
  deepC: ['primeB'],
  primeA: ['keystone'],
  primeB: ['keystone'],
  keystone: [],
}

/** which minor template each minor slot draws from (uniform across branches) */
const MINOR_SLOT_TEMPLATE: Record<
  Exclude<SlotKey, 'notable' | 'keystone'>,
  'primary' | 'secondary'
> = {
  entry: 'primary',
  earlyA: 'secondary',
  earlyB: 'primary',
  earlyC: 'secondary',
  midA: 'primary',
  midB: 'secondary',
  midC: 'primary',
  midD: 'secondary',
  lateA: 'primary',
  lateB: 'secondary',
  lateC: 'primary',
  deepA: 'secondary',
  deepB: 'primary',
  deepC: 'secondary',
  primeA: 'primary',
  primeB: 'secondary',
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const

interface MinorTemplate {
  name: string
  description: string
  effects: Array<SkillEffect>
}

interface SlotContent {
  name: string
  description: string
  effects: Array<SkillEffect>
}

interface BranchDefinition {
  id: Exclude<SkillBranch, 'core'>
  angleDeg: number
  minors: { primary: MinorTemplate; secondary: MinorTemplate }
  notable: SlotContent
  keystone: SlotContent
}

const BRANCH_DEFINITIONS: Array<BranchDefinition> = [
  {
    id: 'offense',
    angleDeg: 0,
    minors: {
      primary: {
        name: 'Hardened Slugs',
        description: '+2% damage',
        effects: [{ stat: 'damagePercent', amount: 2 }],
      },
      secondary: {
        name: 'Targeting Optics',
        description: '+1.5% critical chance',
        effects: [{ stat: 'critChancePercent', amount: 1.5 }],
      },
    },
    notable: {
      name: 'Heavy Rounds',
      description: '+10% damage, +4% critical chance',
      effects: [
        { stat: 'damagePercent', amount: 10 },
        { stat: 'critChancePercent', amount: 4 },
      ],
    },
    keystone: {
      name: 'Executioner',
      description: 'Keystone: +25% damage and +15% critical chance',
      effects: [
        { stat: 'damagePercent', amount: 25 },
        { stat: 'critChancePercent', amount: 15 },
      ],
    },
  },
  {
    id: 'arsenal',
    angleDeg: 51.43,
    minors: {
      primary: {
        name: 'Rifled Barrels',
        description: '+2% projectile speed',
        effects: [{ stat: 'projectileSpeedPercent', amount: 2 }],
      },
      secondary: {
        name: 'Hollow Points',
        description: '+1.5% damage',
        effects: [{ stat: 'damagePercent', amount: 1.5 }],
      },
    },
    notable: {
      name: 'Tungsten Core',
      description: 'Projectiles pierce +1 invader',
      effects: [{ stat: 'pierceFlat', amount: 1 }],
    },
    keystone: {
      name: 'Autoloaders',
      description: 'Keystone: automated loaders — every weapon system cycles 20% faster',
      effects: [{ stat: 'fireRatePercent', amount: 20 }],
    },
  },
  {
    id: 'tech',
    angleDeg: 102.86,
    minors: {
      primary: {
        name: 'Capacitor Banks',
        description: '+2% fire rate',
        effects: [{ stat: 'fireRatePercent', amount: 2 }],
      },
      secondary: {
        name: 'Coil Windings',
        description: '+2% projectile speed',
        effects: [{ stat: 'projectileSpeedPercent', amount: 2 }],
      },
    },
    notable: {
      name: 'Overclock',
      description: '+8% fire rate, +8% projectile speed',
      effects: [
        { stat: 'fireRatePercent', amount: 8 },
        { stat: 'projectileSpeedPercent', amount: 8 },
      ],
    },
    keystone: {
      name: 'Overdrive Core',
      description: 'Keystone: critical strikes hit half again as hard (×3 damage instead of ×2)',
      effects: [{ stat: 'critMultiplierFlat', amount: 1 }],
    },
  },
  {
    id: 'defense',
    angleDeg: 154.29,
    minors: {
      primary: {
        name: 'Basalt Crust',
        description: '+5 max integrity',
        effects: [{ stat: 'maxHpFlat', amount: 5 }],
      },
      secondary: {
        name: 'Self-Sealing Rock',
        description: '+0.2 integrity regen per second',
        effects: [{ stat: 'regenPerSecondFlat', amount: 0.2 }],
      },
    },
    notable: {
      name: 'Bulwark',
      description: '+40 max integrity, +1 integrity regen per second',
      effects: [
        { stat: 'maxHpFlat', amount: 40 },
        { stat: 'regenPerSecondFlat', amount: 1 },
      ],
    },
    keystone: {
      name: 'Aegis Protocol',
      description: 'Keystone: a planetary shield nullifies one invader impact every 12 seconds',
      effects: [{ stat: 'aegisUnlockFlat', amount: 1 }],
    },
  },
  {
    id: 'sensors',
    angleDeg: 205.71,
    minors: {
      primary: {
        name: 'Wide-Band Radar',
        description: '+2% targeting range',
        effects: [{ stat: 'rangePercent', amount: 2 }],
      },
      secondary: {
        name: 'Spectral Lens',
        description: '+1.5% critical chance',
        effects: [{ stat: 'critChancePercent', amount: 1.5 }],
      },
    },
    notable: {
      name: 'Deep-Field Scanner',
      description: '+10% targeting range, +4% critical chance',
      effects: [
        { stat: 'rangePercent', amount: 10 },
        { stat: 'critChancePercent', amount: 4 },
      ],
    },
    keystone: {
      name: 'Farsight Protocol',
      description: 'Keystone: +25% targeting range and projectiles pierce +1 invader',
      effects: [
        { stat: 'rangePercent', amount: 25 },
        { stat: 'pierceFlat', amount: 1 },
      ],
    },
  },
  {
    id: 'fortune',
    angleDeg: 257.14,
    minors: {
      primary: {
        name: 'Survey Probes',
        description: '+2.5% experience gained',
        effects: [{ stat: 'xpPercent', amount: 2.5 }],
      },
      secondary: {
        name: 'Salvage Rigs',
        description: '+3% stardust earned',
        effects: [{ stat: 'stardustPercent', amount: 3 }],
      },
    },
    notable: {
      name: 'Prospector',
      description: '+15% stardust earned, +10% odds of rarer cards',
      effects: [
        { stat: 'stardustPercent', amount: 15 },
        { stat: 'luckPercent', amount: 10 },
      ],
    },
    keystone: {
      name: 'Star Harvest',
      description: 'Keystone: +50% stardust, +20% experience, +15% odds of rarer cards',
      effects: [
        { stat: 'stardustPercent', amount: 50 },
        { stat: 'xpPercent', amount: 20 },
        { stat: 'luckPercent', amount: 15 },
      ],
    },
  },
  {
    id: 'reactor',
    angleDeg: 308.57,
    minors: {
      primary: {
        name: 'Charge Coils',
        description: '+5% capacitor charge rate',
        effects: [{ stat: 'capacitorChargePercent', amount: 5 }],
      },
      secondary: {
        name: 'Trickle Cells',
        description: '+2 stardust generated per hour, even while away',
        effects: [{ stat: 'passivePerHourFlat', amount: 2 }],
      },
    },
    notable: {
      name: 'Surge Regulators',
      description: 'Surges hit +15% harder and last +2s',
      effects: [
        { stat: 'surgeDamagePercent', amount: 15 },
        { stat: 'surgeDurationMsFlat', amount: 2_000 },
      ],
    },
    keystone: {
      name: 'Compound Reactor',
      description: 'Keystone: unspent stardust earns 5% interest at the end of every run',
      effects: [{ stat: 'interestPercentFlat', amount: 5 }],
    },
  },
]

/**
 * Uniform utility slots: the same node appears at this slot on every branch,
 * so the board stays rotationally symmetric. One reroll cache per branch on
 * the mid ring, one banish cache per branch deep in.
 */
const UNIFORM_SLOT_OVERRIDES: Partial<
  Record<SlotKey, { kind: SkillNodeKind; cost: number; content: SlotContent }>
> = {
  midD: {
    kind: 'notable',
    cost: 250,
    content: {
      name: 'Tactical Reserve',
      description: '+1 card reroll per run',
      effects: [{ stat: 'rerollFlat', amount: 1 }],
    },
  },
  deepC: {
    kind: 'notable',
    cost: 350,
    content: {
      name: 'Exclusion Protocol',
      description: '+1 card banish per run — strike an offered card from the rest of the run',
      effects: [{ stat: 'banishFlat', amount: 1 }],
    },
  },
}

const SLOT_KEYS: Array<SlotKey> = [
  'entry',
  'earlyA',
  'earlyB',
  'earlyC',
  'midA',
  'midB',
  'midC',
  'midD',
  'notable',
  'lateA',
  'lateB',
  'lateC',
  'deepA',
  'deepB',
  'deepC',
  'primeA',
  'primeB',
  'keystone',
]

function nodeIdFor({ branchId, slot }: { branchId: string; slot: SlotKey }): string {
  return `${branchId}-${slot}`
}

function polarPoint({ radius, angleDeg }: { radius: number; angleDeg: number }): {
  x: number
  y: number
} {
  const angleRad = (angleDeg * Math.PI) / 180
  return {
    x: Math.round(Math.cos(angleRad) * radius),
    y: Math.round(Math.sin(angleRad) * radius),
  }
}

function buildBranchNodes({ branch }: { branch: BranchDefinition }): Array<SkillNode> {
  const templateCounts = { primary: 0, secondary: 0 }

  return SLOT_KEYS.map((slot) => {
    const layout = SLOT_LAYOUT[slot]
    const { x, y } = polarPoint({
      radius: layout.radius,
      angleDeg: branch.angleDeg + layout.angleOffsetDeg,
    })

    const override = UNIFORM_SLOT_OVERRIDES[slot]

    let content: SlotContent
    let kind = layout.kind
    let cost = layout.cost
    if (override !== undefined) {
      content = override.content
      kind = override.kind
      cost = override.cost
    } else if (slot === 'notable') {
      content = branch.notable
    } else if (slot === 'keystone') {
      content = branch.keystone
    } else {
      const templateKey = MINOR_SLOT_TEMPLATE[slot]
      const template = branch.minors[templateKey]
      templateCounts[templateKey] += 1
      content = {
        name: `${template.name} ${ROMAN_NUMERALS[templateCounts[templateKey] - 1]}`,
        description: template.description,
        effects: template.effects,
      }
    }

    return {
      id: nodeIdFor({ branchId: branch.id, slot }),
      name: content.name,
      description: content.description,
      kind,
      tier: TIER_BY_KIND[kind],
      branch: branch.id,
      cost,
      x,
      y,
      connections: SLOT_CONNECTIONS[slot].map((targetSlot) =>
        nodeIdFor({ branchId: branch.id, slot: targetSlot }),
      ),
      effects: content.effects,
    }
  })
}

function buildSkillNodes(): Array<SkillNode> {
  const rootNode: SkillNode = {
    id: ROOT_NODE_ID,
    name: 'Planetary Core',
    description: 'The heart of your world. All paths begin here.',
    kind: 'root',
    tier: 'common',
    branch: 'core',
    cost: 0,
    x: 0,
    y: 0,
    connections: BRANCH_DEFINITIONS.map((branch) =>
      nodeIdFor({ branchId: branch.id, slot: 'entry' }),
    ),
    effects: [],
  }

  const branchNodes = BRANCH_DEFINITIONS.flatMap((branch) => buildBranchNodes({ branch }))

  // ring links between adjacent branches: inner at the early tier, outer at
  // the late tier — deep builds can path around the board without the core
  const addRingLink = ({ fromId, toId }: { fromId: string; toId: string }): void => {
    const fromNode = branchNodes.find((node) => node.id === fromId)
    if (fromNode !== undefined) {
      fromNode.connections = [...fromNode.connections, toId]
    }
  }
  for (let index = 0; index < BRANCH_DEFINITIONS.length; index += 1) {
    const current = BRANCH_DEFINITIONS[index]
    const next = BRANCH_DEFINITIONS[(index + 1) % BRANCH_DEFINITIONS.length]
    addRingLink({
      fromId: nodeIdFor({ branchId: current.id, slot: 'earlyC' }),
      toId: nodeIdFor({ branchId: next.id, slot: 'earlyA' }),
    })
    addRingLink({
      fromId: nodeIdFor({ branchId: current.id, slot: 'lateC' }),
      toId: nodeIdFor({ branchId: next.id, slot: 'lateA' }),
    })
  }

  // expansion nodes: the deepest investments, one hanging beyond every keystone
  const EXPANSION_RADIUS = 970
  const expansionNodes: Array<SkillNode> = [
    {
      id: 'offense-expansion',
      name: 'Forward Battery',
      description: '+1 cannon — start every run with an additional emplacement',
      kind: 'notable',
      tier: 'legendary',
      branch: 'offense',
      cost: 3_000,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 0 }),
      connections: [],
      effects: [{ stat: 'cannonFlat', amount: 1 }],
    },
    {
      id: 'arsenal-expansion',
      name: 'Ordnance Bay',
      description: '+1 weapon slot — carry an additional weapon type each run',
      kind: 'notable',
      tier: 'legendary',
      branch: 'arsenal',
      cost: 3_400,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 51.43 }),
      connections: [],
      effects: [{ stat: 'weaponSlotFlat', amount: 1 }],
    },
    {
      id: 'tech-expansion',
      name: 'Prototype Lab',
      description: '+1 maximum tier on every weapon card — keep ranking up past ★5',
      kind: 'notable',
      tier: 'legendary',
      branch: 'tech',
      cost: 4_000,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 102.86 }),
      connections: [],
      effects: [{ stat: 'weaponTierFlat', amount: 1 }],
    },
    {
      id: 'defense-expansion',
      name: 'Bastion Emplacement',
      description: '+1 cannon — start every run with an additional emplacement',
      kind: 'notable',
      tier: 'legendary',
      branch: 'defense',
      cost: 3_000,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 154.29 }),
      connections: [],
      effects: [{ stat: 'cannonFlat', amount: 1 }],
    },
    {
      id: 'sensors-expansion',
      name: 'Modular Racks',
      description: '+1 weapon slot — carry an additional weapon type each run',
      kind: 'notable',
      tier: 'legendary',
      branch: 'sensors',
      cost: 3_400,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 205.71 }),
      connections: [],
      effects: [{ stat: 'weaponSlotFlat', amount: 1 }],
    },
    {
      id: 'fortune-expansion',
      name: 'Star Forge',
      description: '+1 maximum tier on every weapon card — keep ranking up past ★5',
      kind: 'notable',
      tier: 'legendary',
      branch: 'fortune',
      cost: 4_000,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 257.14 }),
      connections: [],
      effects: [{ stat: 'weaponTierFlat', amount: 1 }],
    },
    {
      id: 'reactor-expansion',
      name: 'Overcharge Core',
      description: 'Start every run with the capacitor half charged, and surges hit +25% harder',
      kind: 'notable',
      tier: 'legendary',
      branch: 'reactor',
      cost: 3_000,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 308.57 }),
      connections: [],
      effects: [
        { stat: 'capacitorStartPercent', amount: 50 },
        { stat: 'surgeDamagePercent', amount: 25 },
      ],
    },
  ]
  for (const expansion of expansionNodes) {
    const keystone = branchNodes.find(
      (node) => node.id === nodeIdFor({ branchId: expansion.branch, slot: 'keystone' }),
    )
    if (keystone !== undefined) {
      keystone.connections = [...keystone.connections, expansion.id]
    }
  }

  return [rootNode, ...branchNodes, ...expansionNodes]
}

export const SKILL_NODES: Array<SkillNode> = buildSkillNodes()

export const SKILL_NODES_BY_ID: Map<string, SkillNode> = new Map(
  SKILL_NODES.map((node) => [node.id, node]),
)

/** Every bidirectional edge exactly once, as [fromId, toId] pairs. */
export const SKILL_EDGES: Array<[string, string]> = SKILL_NODES.flatMap((node) =>
  node.connections.map((targetId): [string, string] => [node.id, targetId]),
)

export function listAdjacentNodeIds({ nodeId }: { nodeId: string }): Array<string> {
  const adjacent = new Set<string>()
  for (const [fromId, toId] of SKILL_EDGES) {
    if (fromId === nodeId) {
      adjacent.add(toId)
    }
    if (toId === nodeId) {
      adjacent.add(fromId)
    }
  }
  return [...adjacent]
}

export function aggregateEffects({
  unlockedNodeIds,
}: {
  unlockedNodeIds: Array<string>
}): Map<MetaStat, number> {
  const totals = new Map<MetaStat, number>()
  for (const nodeId of unlockedNodeIds) {
    const node = SKILL_NODES_BY_ID.get(nodeId)
    if (node === undefined) {
      continue
    }
    for (const effect of node.effects) {
      totals.set(effect.stat, (totals.get(effect.stat) ?? 0) + effect.amount)
    }
  }
  return totals
}

/** every prestige permanently staffs one more gun emplacement, up to the slot cap */
export function applyPrestige({
  stats,
  prestigeLevel,
}: {
  stats: RunStats
  prestigeLevel: number
}): RunStats {
  return {
    ...stats,
    cannonCount: Math.min(
      PRESTIGE.maxCannons,
      stats.cannonCount + PRESTIGE.bonusCannonsPerLevel * prestigeLevel,
    ),
  }
}

export function buildStartingStats({
  unlockedNodeIds,
}: {
  unlockedNodeIds: Array<string>
}): RunStats {
  const totals = aggregateEffects({ unlockedNodeIds })
  const valueOf = (stat: MetaStat): number => totals.get(stat) ?? 0

  return {
    ...BASE_RUN_STATS,
    cannonCount: BASE_RUN_STATS.cannonCount + valueOf('cannonFlat'),
    weaponTierBonus: BASE_RUN_STATS.weaponTierBonus + valueOf('weaponTierFlat'),
    damage: BASE_RUN_STATS.damage * (1 + valueOf('damagePercent') / 100),
    fireIntervalMs: BASE_RUN_STATS.fireIntervalMs / (1 + valueOf('fireRatePercent') / 100),
    projectileSpeed: BASE_RUN_STATS.projectileSpeed * (1 + valueOf('projectileSpeedPercent') / 100),
    range: BASE_RUN_STATS.range * (1 + valueOf('rangePercent') / 100),
    critChance: BASE_RUN_STATS.critChance + valueOf('critChancePercent') / 100,
    pierce: BASE_RUN_STATS.pierce + valueOf('pierceFlat'),
    maxHp: BASE_RUN_STATS.maxHp + valueOf('maxHpFlat'),
    regenPerSecond: BASE_RUN_STATS.regenPerSecond + valueOf('regenPerSecondFlat'),
    // fire rate is global haste: the same boost speeds the main cannon
    // (fireIntervalMs above) and every auxiliary weapon's cooldown
    weaponCooldownFactor:
      BASE_RUN_STATS.weaponCooldownFactor / (1 + valueOf('fireRatePercent') / 100),
    critMultiplier: BASE_RUN_STATS.critMultiplier + valueOf('critMultiplierFlat'),
    aegisIntervalMs: valueOf('aegisUnlockFlat') > 0 ? AEGIS_BLOCK_INTERVAL_MS : null,
    weaponSlots: BASE_RUN_STATS.weaponSlots + valueOf('weaponSlotFlat'),
    rerollsPerRun: BASE_RUN_STATS.rerollsPerRun + valueOf('rerollFlat'),
    banishesPerRun: BASE_RUN_STATS.banishesPerRun + valueOf('banishFlat'),
    luck: BASE_RUN_STATS.luck * (1 + valueOf('luckPercent') / 100),
    xpMultiplier: BASE_RUN_STATS.xpMultiplier * (1 + valueOf('xpPercent') / 100),
    capacitorChargeRate:
      BASE_RUN_STATS.capacitorChargeRate * (1 + valueOf('capacitorChargePercent') / 100),
    surgeDamageBonus: BASE_RUN_STATS.surgeDamageBonus + valueOf('surgeDamagePercent') / 100,
    surgeDurationMs: BASE_RUN_STATS.surgeDurationMs + valueOf('surgeDurationMsFlat'),
    capacitorStartFraction: Math.min(
      1,
      BASE_RUN_STATS.capacitorStartFraction + valueOf('capacitorStartPercent') / 100,
    ),
  }
}

export function stardustMultiplierFrom({
  unlockedNodeIds,
}: {
  unlockedNodeIds: Array<string>
}): number {
  const totals = aggregateEffects({ unlockedNodeIds })
  return 1 + (totals.get('stardustPercent') ?? 0) / 100
}

/** stardust generated per real-world hour by the reactor's trickle cells */
export function passiveStardustPerHourFrom({
  unlockedNodeIds,
}: {
  unlockedNodeIds: Array<string>
}): number {
  const totals = aggregateEffects({ unlockedNodeIds })
  return totals.get('passivePerHourFlat') ?? 0
}

/** interest rate (percent) paid on unspent stardust at the end of every run */
export function interestPercentFrom({
  unlockedNodeIds,
}: {
  unlockedNodeIds: Array<string>
}): number {
  const totals = aggregateEffects({ unlockedNodeIds })
  return totals.get('interestPercentFlat') ?? 0
}
