import {
  AEGIS_BLOCK_INTERVAL_MS,
  BASE_RUN_STATS,
  NOVA_START_INTERVAL_MS,
} from '@/game/data/balance'
import type { RunStats } from '@/game/types'

export type SkillNodeKind = 'root' | 'minor' | 'notable' | 'keystone'

export type SkillBranch =
  | 'core'
  | 'offense'
  | 'arsenal'
  | 'tech'
  | 'defense'
  | 'sensors'
  | 'fortune'

export type MetaStat =
  | 'damagePercent'
  | 'fireRatePercent'
  | 'projectileSpeedPercent'
  | 'rangePercent'
  | 'critChancePercent'
  | 'pierceFlat'
  | 'projectileCountFlat'
  | 'maxHpFlat'
  | 'regenPerSecondFlat'
  | 'novaUnlockFlat'
  | 'aegisUnlockFlat'
  | 'weaponSlotFlat'
  | 'weaponTierFlat'
  | 'cannonFlat'
  | 'luckPercent'
  | 'xpPercent'
  | 'stardustPercent'

export interface SkillEffect {
  stat: MetaStat
  amount: number
}

export interface SkillNode {
  id: string
  name: string
  description: string
  kind: SkillNodeKind
  branch: SkillBranch
  cost: number
  x: number
  y: number
  /** ids of nodes this node connects to (edges are bidirectional) */
  connections: Array<string>
  effects: Array<SkillEffect>
}

export const ROOT_NODE_ID = 'core'

// ── rotationally symmetric layout ─────────────────────────────────────
// Six branches at 60° intervals share one slot geometry; only the content
// differs per branch. Minors come in many small increments. Two rings link
// adjacent branches: an inner one at the early tier and an outer one at the
// late tier, so deep cross-branch pathing never has to return to the core.

type SlotKey =
  | 'entry'
  | 'earlyA'
  | 'earlyB'
  | 'midA'
  | 'midB'
  | 'midC'
  | 'notable'
  | 'lateA'
  | 'lateB'
  | 'deepA'
  | 'deepB'
  | 'keystone'

interface SlotLayout {
  radius: number
  angleOffsetDeg: number
  kind: SkillNodeKind
  cost: number
}

const SLOT_LAYOUT: Record<SlotKey, SlotLayout> = {
  entry: { radius: 100, angleOffsetDeg: 0, kind: 'minor', cost: 10 },
  earlyA: { radius: 185, angleOffsetDeg: -16, kind: 'minor', cost: 12 },
  earlyB: { radius: 185, angleOffsetDeg: 16, kind: 'minor', cost: 12 },
  midA: { radius: 270, angleOffsetDeg: -24, kind: 'minor', cost: 15 },
  midB: { radius: 270, angleOffsetDeg: 24, kind: 'minor', cost: 15 },
  midC: { radius: 270, angleOffsetDeg: 0, kind: 'minor', cost: 15 },
  notable: { radius: 360, angleOffsetDeg: 0, kind: 'notable', cost: 50 },
  lateA: { radius: 450, angleOffsetDeg: -18, kind: 'minor', cost: 20 },
  lateB: { radius: 450, angleOffsetDeg: 18, kind: 'minor', cost: 20 },
  deepA: { radius: 540, angleOffsetDeg: -10, kind: 'minor', cost: 30 },
  deepB: { radius: 540, angleOffsetDeg: 10, kind: 'minor', cost: 30 },
  keystone: { radius: 630, angleOffsetDeg: 0, kind: 'keystone', cost: 180 },
}

const SLOT_CONNECTIONS: Record<SlotKey, Array<SlotKey>> = {
  entry: ['earlyA', 'earlyB'],
  earlyA: ['midA', 'midC'],
  earlyB: ['midB', 'midC'],
  midA: ['notable'],
  midB: ['notable'],
  midC: ['notable'],
  notable: ['lateA', 'lateB'],
  lateA: ['deepA'],
  lateB: ['deepB'],
  deepA: ['keystone'],
  deepB: ['keystone'],
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
  midA: 'primary',
  midB: 'secondary',
  midC: 'secondary',
  lateA: 'primary',
  lateB: 'secondary',
  deepA: 'primary',
  deepB: 'secondary',
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const

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
        description: '+3% damage',
        effects: [{ stat: 'damagePercent', amount: 3 }],
      },
      secondary: {
        name: 'Targeting Optics',
        description: '+2% critical chance',
        effects: [{ stat: 'critChancePercent', amount: 2 }],
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
    angleDeg: 60,
    minors: {
      primary: {
        name: 'Rifled Barrels',
        description: '+3% projectile speed',
        effects: [{ stat: 'projectileSpeedPercent', amount: 3 }],
      },
      secondary: {
        name: 'Hollow Points',
        description: '+2% damage',
        effects: [{ stat: 'damagePercent', amount: 2 }],
      },
    },
    notable: {
      name: 'Tungsten Core',
      description: 'Projectiles pierce +1 invader',
      effects: [{ stat: 'pierceFlat', amount: 1 }],
    },
    keystone: {
      name: 'Twin Cannons',
      description: 'Keystone: start every run with +1 projectile per volley',
      effects: [{ stat: 'projectileCountFlat', amount: 1 }],
    },
  },
  {
    id: 'tech',
    angleDeg: 120,
    minors: {
      primary: {
        name: 'Capacitor Banks',
        description: '+3% fire rate',
        effects: [{ stat: 'fireRatePercent', amount: 3 }],
      },
      secondary: {
        name: 'Coil Windings',
        description: '+3% projectile speed',
        effects: [{ stat: 'projectileSpeedPercent', amount: 3 }],
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
      name: 'Nova Core',
      description: 'Keystone: start every run with the Nova Pulse shockwave',
      effects: [{ stat: 'novaUnlockFlat', amount: 1 }],
    },
  },
  {
    id: 'defense',
    angleDeg: 180,
    minors: {
      primary: {
        name: 'Basalt Crust',
        description: '+8 max integrity',
        effects: [{ stat: 'maxHpFlat', amount: 8 }],
      },
      secondary: {
        name: 'Self-Sealing Rock',
        description: '+0.3 integrity regen per second',
        effects: [{ stat: 'regenPerSecondFlat', amount: 0.3 }],
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
    angleDeg: 240,
    minors: {
      primary: {
        name: 'Wide-Band Radar',
        description: '+3% targeting range',
        effects: [{ stat: 'rangePercent', amount: 3 }],
      },
      secondary: {
        name: 'Spectral Lens',
        description: '+2% critical chance',
        effects: [{ stat: 'critChancePercent', amount: 2 }],
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
    angleDeg: 300,
    minors: {
      primary: {
        name: 'Survey Probes',
        description: '+4% experience gained',
        effects: [{ stat: 'xpPercent', amount: 4 }],
      },
      secondary: {
        name: 'Salvage Rigs',
        description: '+5% stardust earned',
        effects: [{ stat: 'stardustPercent', amount: 5 }],
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
]

const SLOT_KEYS: Array<SlotKey> = [
  'entry',
  'earlyA',
  'earlyB',
  'midA',
  'midB',
  'midC',
  'notable',
  'lateA',
  'lateB',
  'deepA',
  'deepB',
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

    let content: SlotContent
    if (slot === 'notable') {
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
      kind: layout.kind,
      branch: branch.id,
      cost: layout.cost,
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
      fromId: nodeIdFor({ branchId: current.id, slot: 'earlyB' }),
      toId: nodeIdFor({ branchId: next.id, slot: 'earlyA' }),
    })
    addRingLink({
      fromId: nodeIdFor({ branchId: current.id, slot: 'lateB' }),
      toId: nodeIdFor({ branchId: next.id, slot: 'lateA' }),
    })
  }

  // expansion nodes: the deepest investments, one hanging beyond every keystone
  const EXPANSION_RADIUS = 740
  const expansionNodes: Array<SkillNode> = [
    {
      id: 'offense-expansion',
      name: 'Forward Battery',
      description: '+1 cannon — start every run with an additional emplacement',
      kind: 'notable',
      branch: 'offense',
      cost: 250,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 0 }),
      connections: [],
      effects: [{ stat: 'cannonFlat', amount: 1 }],
    },
    {
      id: 'arsenal-expansion',
      name: 'Ordnance Bay',
      description: '+1 weapon slot — carry an additional weapon type each run',
      kind: 'notable',
      branch: 'arsenal',
      cost: 220,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 60 }),
      connections: [],
      effects: [{ stat: 'weaponSlotFlat', amount: 1 }],
    },
    {
      id: 'tech-expansion',
      name: 'Modular Racks',
      description: '+1 weapon slot — carry an additional weapon type each run',
      kind: 'notable',
      branch: 'tech',
      cost: 220,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 120 }),
      connections: [],
      effects: [{ stat: 'weaponSlotFlat', amount: 1 }],
    },
    {
      id: 'defense-expansion',
      name: 'Bastion Emplacement',
      description: '+1 cannon — start every run with an additional emplacement',
      kind: 'notable',
      branch: 'defense',
      cost: 250,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 180 }),
      connections: [],
      effects: [{ stat: 'cannonFlat', amount: 1 }],
    },
    {
      id: 'sensors-expansion',
      name: 'Prototype Lab',
      description: '+1 maximum tier on every weapon card — keep ranking up past ★5',
      kind: 'notable',
      branch: 'sensors',
      cost: 240,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 240 }),
      connections: [],
      effects: [{ stat: 'weaponTierFlat', amount: 1 }],
    },
    {
      id: 'fortune-expansion',
      name: 'Star Forge',
      description: '+1 maximum tier on every weapon card — keep ranking up past ★5',
      kind: 'notable',
      branch: 'fortune',
      cost: 240,
      ...polarPoint({ radius: EXPANSION_RADIUS, angleDeg: 300 }),
      connections: [],
      effects: [{ stat: 'weaponTierFlat', amount: 1 }],
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
    projectileCount: BASE_RUN_STATS.projectileCount + valueOf('projectileCountFlat'),
    maxHp: BASE_RUN_STATS.maxHp + valueOf('maxHpFlat'),
    regenPerSecond: BASE_RUN_STATS.regenPerSecond + valueOf('regenPerSecondFlat'),
    novaIntervalMs: valueOf('novaUnlockFlat') > 0 ? NOVA_START_INTERVAL_MS : null,
    aegisIntervalMs: valueOf('aegisUnlockFlat') > 0 ? AEGIS_BLOCK_INTERVAL_MS : null,
    weaponSlots: BASE_RUN_STATS.weaponSlots + valueOf('weaponSlotFlat'),
    luck: BASE_RUN_STATS.luck * (1 + valueOf('luckPercent') / 100),
    xpMultiplier: BASE_RUN_STATS.xpMultiplier * (1 + valueOf('xpPercent') / 100),
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
