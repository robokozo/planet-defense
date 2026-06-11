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

  // saves from before a tree redesign reference node ids that no longer
  // exist: reset the tree and refund everything ever earned
  const hasUnknownNode = unlockedNodeIds.value.some(
    (nodeId) => SKILL_NODES_BY_ID.has(nodeId) === false,
  )
  if (hasUnknownNode === true) {
    unlockedNodeIds.value = [ROOT_NODE_ID]
    stardust.value = lifetime.value.totalStardustEarned
  }

  const unlockedNodeIdSet = computed(() => new Set(unlockedNodeIds.value))

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
    return stardust.value >= node.cost
  }

  function unlockNode({ nodeId }: { nodeId: string }): boolean {
    if (canUnlockNode({ nodeId }) === false) {
      return false
    }
    const node = SKILL_NODES_BY_ID.get(nodeId)
    if (node === undefined) {
      return false
    }
    stardust.value -= node.cost
    unlockedNodeIds.value = [...unlockedNodeIds.value, nodeId]
    return true
  }

  function resetTree(): void {
    const refund = unlockedNodeIds.value.reduce((sum, nodeId) => {
      const node = SKILL_NODES_BY_ID.get(nodeId)
      if (node === undefined) {
        return sum
      }
      return sum + node.cost
    }, 0)
    stardust.value += refund
    unlockedNodeIds.value = [ROOT_NODE_ID]
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

  const totalSpentOnTree = computed(() =>
    SKILL_NODES.reduce((sum, node) => {
      if (unlockedNodeIdSet.value.has(node.id) === true) {
        return sum + node.cost
      }
      return sum
    }, 0),
  )

  return {
    stardust,
    unlockedNodeIds,
    lifetime,
    unlockedNodeIdSet,
    availableNodeIdSet,
    totalSpentOnTree,
    canUnlockNode,
    unlockNode,
    resetTree,
    recordRun,
  }
})
