import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import type { RunResult } from '@/game/types'
import {
  ROOT_NODE_ID,
  SKILL_NODES,
  SKILL_NODES_BY_ID,
  listAdjacentNodeIds,
} from '@/skills/skillTree'

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

  /** wipe the save entirely: stardust, tree, lifetime stats, prestige */
  function resetAllProgress(): void {
    stardust.value = 0
    unlockedNodeIds.value = [ROOT_NODE_ID]
    treeSpent.value = 0
    prestigeLevel.value = 0
    lifetime.value = { ...DEFAULT_LIFETIME_STATS }
  }

  /** the whole save as a copyable code (base64 JSON) for moving between devices */
  function exportSave(): string {
    const payload = {
      version: 1,
      stardust: stardust.value,
      unlockedNodeIds: unlockedNodeIds.value,
      treeSpent: treeSpent.value,
      prestigeLevel: prestigeLevel.value,
      lifetime: lifetime.value,
    }
    return btoa(JSON.stringify(payload))
  }

  function importSave({ code }: { code: string }): boolean {
    try {
      const payload = JSON.parse(atob(code.trim())) as {
        version?: number
        stardust?: number
        unlockedNodeIds?: Array<string>
        treeSpent?: number
        prestigeLevel?: number
        lifetime?: LifetimeStats
      }
      if (
        typeof payload.stardust !== 'number' ||
        Array.isArray(payload.unlockedNodeIds) === false ||
        payload.lifetime === undefined
      ) {
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
      lifetime.value = {
        runs: Number(payload.lifetime.runs ?? 0),
        kills: Number(payload.lifetime.kills ?? 0),
        bestWave: Number(payload.lifetime.bestWave ?? 0),
        totalStardustEarned: Number(payload.lifetime.totalStardustEarned ?? 0),
      }
      return true
    } catch {
      return false
    }
  }

  function recordRun({ result }: { result: RunResult }): void {
    stardust.value += result.stardustEarned
    lifetime.value = {
      runs: lifetime.value.runs + 1,
      kills: lifetime.value.kills + result.kills,
      bestWave: Math.max(lifetime.value.bestWave, result.waveReached),
      totalStardustEarned: lifetime.value.totalStardustEarned + result.stardustEarned,
    }
  }

  const totalSpentOnTree = computed(() => treeSpent.value)

  return {
    stardust,
    unlockedNodeIds,
    lifetime,
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
