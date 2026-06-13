import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { UPGRADE_DEFINITIONS } from '@/game/data/upgrades'
import type { RunResult } from '@/game/types'
import {
  ROOT_NODE_ID,
  SKILL_NODES,
  SKILL_NODES_BY_ID,
  interestPercentFrom,
  listAdjacentNodeIds,
} from '@/skills/skillTree'

/** display names for the weapon cards, so favorites can be shown without the run loaded */
const WEAPON_NAME_BY_ID = new Map(
  UPGRADE_DEFINITIONS.filter((definition) => definition.category === 'weapon').map((definition) => [
    definition.id,
    definition.name,
  ]),
)

interface LifetimeStats {
  runs: number
  kills: number
  bestWave: number
  totalStardustEarned: number
}

const DEFAULT_LIFETIME_STATS: LifetimeStats = {
  runs: 0,
  kills: 0,
  bestWave: 0,
  totalStardustEarned: 0,
}

export const useMetaStore = defineStore('meta', () => {
  const stardust = useLocalStorage<number>('pd-stardust', 0)
  const unlockedNodeIds = useLocalStorage<Array<string>>('pd-unlocked-nodes', [ROOT_NODE_ID])
  const lifetime = useLocalStorage<LifetimeStats>('pd-lifetime', { ...DEFAULT_LIFETIME_STATS })
  // what the tree actually cost so resets refund exactly that — saves from
  // before paragon cost scaling paid flat base costs, hence the default
  const treeSpent = useLocalStorage<number>(
    'pd-tree-spent',
    unlockedNodeIds.value.reduce(
      (sum, nodeId) => sum + (SKILL_NODES_BY_ID.get(nodeId)?.cost ?? 0),
      0,
    ),
  )
  const prestigeLevel = useLocalStorage<number>('pd-prestige', 0)
  // how many times each weapon card has been picked across all runs — drives the
  // "favorite weapons" readout. Lifetime preference data, so it survives prestige.
  const weaponPicks = useLocalStorage<Record<string, number>>('pd-weapon-picks', {})

  // saves from before a tree redesign reference node ids that no longer
  // exist: reset the tree and refund everything ever earned
  const hasUnknownNode = unlockedNodeIds.value.some(
    (nodeId) => SKILL_NODES_BY_ID.has(nodeId) === false,
  )
  if (hasUnknownNode === true) {
    unlockedNodeIds.value = [ROOT_NODE_ID]
    stardust.value = lifetime.value.totalStardustEarned
    treeSpent.value = 0
  }

  const unlockedNodeIdSet = computed(() => new Set(unlockedNodeIds.value))

  /** weapons the player picks most, most-picked first — for the home favorites list */
  const favoriteWeapons = computed(() =>
    Object.entries(weaponPicks.value)
      .filter(([id, count]) => count > 0 && WEAPON_NAME_BY_ID.has(id))
      .map(([id, count]) => ({ id, name: WEAPON_NAME_BY_ID.get(id) as string, count }))
      .sort((a, b) => b.count - a.count),
  )

  /** count a weapon card the player chose during a run */
  function recordWeaponPick({ id }: { id: string }): void {
    weaponPicks.value = { ...weaponPicks.value, [id]: (weaponPicks.value[id] ?? 0) + 1 }
  }

  /** points bought so far (the free root doesn't count) — board progress */
  const paragonLevel = computed(() => Math.max(0, unlockedNodeIds.value.length - 1))

  /** node prices are flat — this stays the single lookup the UI and unlocks share */
  function nodeCostOf({ nodeId }: { nodeId: string }): number {
    return SKILL_NODES_BY_ID.get(nodeId)?.cost ?? 0
  }

  const availableNodeIdSet = computed(() => {
    const available = new Set<string>()
    for (const nodeId of unlockedNodeIds.value) {
      for (const adjacentId of listAdjacentNodeIds({ nodeId })) {
        if (unlockedNodeIdSet.value.has(adjacentId) === false) {
          available.add(adjacentId)
        }
      }
    }
    return available
  })

  function canUnlockNode({ nodeId }: { nodeId: string }): boolean {
    const node = SKILL_NODES_BY_ID.get(nodeId)
    if (node === undefined) {
      return false
    }
    if (unlockedNodeIdSet.value.has(nodeId) === true) {
      return false
    }
    if (availableNodeIdSet.value.has(nodeId) === false) {
      return false
    }
    return stardust.value >= nodeCostOf({ nodeId })
  }

  function unlockNode({ nodeId }: { nodeId: string }): boolean {
    if (canUnlockNode({ nodeId }) === false) {
      return false
    }
    const cost = nodeCostOf({ nodeId })
    stardust.value -= cost
    treeSpent.value += cost
    unlockedNodeIds.value = [...unlockedNodeIds.value, nodeId]
    return true
  }

  function resetTree(): void {
    stardust.value += treeSpent.value
    treeSpent.value = 0
    unlockedNodeIds.value = [ROOT_NODE_ID]
  }

  /** prestige unlocks only when every node on the paragon board is bought */
  const isParagonComplete = computed(() => unlockedNodeIds.value.length >= SKILL_NODES.length)

  /**
   * Prestige: wipe stardust and the tree (no refund — the board is the price)
   * and pull the view back one step. Lifetime stats and settings survive.
   */
  function prestige(): boolean {
    if (isParagonComplete.value === false) {
      return false
    }
    prestigeLevel.value += 1
    stardust.value = 0
    treeSpent.value = 0
    unlockedNodeIds.value = [ROOT_NODE_ID]
    return true
  }

  /** wipe the save entirely: stardust, tree, lifetime stats, prestige, favorites */
  function resetAllProgress(): void {
    stardust.value = 0
    unlockedNodeIds.value = [ROOT_NODE_ID]
    treeSpent.value = 0
    prestigeLevel.value = 0
    lifetime.value = { ...DEFAULT_LIFETIME_STATS }
    weaponPicks.value = {}
  }

  /**
   * A copyable code for moving progress between devices. It carries only the
   * progression that matters — stardust and the paragon tree (with its spend and
   * prestige). Device-local extras like lifetime stats and favorite weapons are
   * deliberately left out, so a transfer doesn't clobber the destination's history.
   */
  function exportSave(): string {
    const payload = {
      version: 1,
      stardust: stardust.value,
      unlockedNodeIds: unlockedNodeIds.value,
      treeSpent: treeSpent.value,
      prestigeLevel: prestigeLevel.value,
    }
    return btoa(JSON.stringify(payload))
  }

  function importSave({ code }: { code: string }): boolean {
    try {
      // older codes may also carry lifetime/weaponPicks; we simply ignore them now,
      // leaving this device's own stats and favorites untouched
      const payload = JSON.parse(atob(code.trim())) as {
        version?: number
        stardust?: number
        unlockedNodeIds?: Array<string>
        treeSpent?: number
        prestigeLevel?: number
      }
      if (typeof payload.stardust !== 'number' || Array.isArray(payload.unlockedNodeIds) === false) {
        return false
      }
      stardust.value = payload.stardust
      // unknown node ids (older tree layouts) fall back to the refund migration on reload
      unlockedNodeIds.value = payload.unlockedNodeIds.filter(
        (nodeId): nodeId is string => typeof nodeId === 'string',
      )
      if (unlockedNodeIds.value.includes(ROOT_NODE_ID) === false) {
        unlockedNodeIds.value = [ROOT_NODE_ID, ...unlockedNodeIds.value]
      }
      // codes from before paragon cost scaling carry no spend — assume flat base costs
      treeSpent.value =
        typeof payload.treeSpent === 'number'
          ? payload.treeSpent
          : unlockedNodeIds.value.reduce(
              (sum, nodeId) => sum + (SKILL_NODES_BY_ID.get(nodeId)?.cost ?? 0),
              0,
            )
      prestigeLevel.value = typeof payload.prestigeLevel === 'number' ? payload.prestigeLevel : 0
      return true
    } catch {
      return false
    }
  }

  function recordRun({ result }: { result: RunResult }): void {
    // compound reactor keystone: the dust that sat unspent through the run pays interest
    const interestPercent = interestPercentFrom({ unlockedNodeIds: unlockedNodeIds.value })
    const interest = Math.floor((stardust.value * interestPercent) / 100)
    stardust.value += result.stardustEarned + interest
    lifetime.value = {
      runs: lifetime.value.runs + 1,
      kills: lifetime.value.kills + result.kills,
      bestWave: Math.max(lifetime.value.bestWave, result.waveReached),
      totalStardustEarned: lifetime.value.totalStardustEarned + result.stardustEarned + interest,
    }
  }

  const totalSpentOnTree = computed(() => treeSpent.value)

  return {
    stardust,
    unlockedNodeIds,
    lifetime,
    weaponPicks,
    favoriteWeapons,
    recordWeaponPick,
    unlockedNodeIdSet,
    availableNodeIdSet,
    paragonLevel,
    prestigeLevel,
    isParagonComplete,
    nodeCostOf,
    totalSpentOnTree,
    canUnlockNode,
    unlockNode,
    resetTree,
    prestige,
    resetAllProgress,
    exportSave,
    importSave,
    recordRun,
  }
})
