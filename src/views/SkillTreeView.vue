<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  SKILL_EDGES,
  SKILL_NODES,
  SKILL_NODES_BY_ID,
  type SkillNode,
  type SkillNodeKind,
} from '@/skills/skillTree'
import { useMetaStore } from '@/stores/metaStore'

const metaStore = useMetaStore()

const VIEW_BASE_WIDTH = 1500
const VIEW_BASE_HEIGHT = 1000
const ZOOM_MIN = 0.4
const ZOOM_MAX = 2.2
const ZOOM_STEP = 1.12

const cameraX = ref(0)
const cameraY = ref(0)
const zoom = ref(0.6)
const selectedNodeId = ref<string | null>(null)
const isConfirmingReset = ref(false)

const svgElement = ref<SVGSVGElement | null>(null)
const activePointers = new Map<number, { x: number; y: number }>()
let lastPinchDistance = 0
let isDraggingCamera = false

const hoveredNodeId = ref<string | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

const hoveredNode = computed<SkillNode | null>(() => {
  if (hoveredNodeId.value === null) {
    return null
  }
  return SKILL_NODES_BY_ID.get(hoveredNodeId.value) ?? null
})

function onNodeHover({ nodeId, event }: { nodeId: string; event: PointerEvent }): void {
  hoveredNodeId.value = nodeId
  const container = svgElement.value?.parentElement ?? null
  if (container === null) {
    return
  }
  const bounds = container.getBoundingClientRect()
  tooltipX.value = Math.min(event.clientX - bounds.left + 14, bounds.width - 290)
  tooltipY.value = Math.min(event.clientY - bounds.top + 14, bounds.height - 150)
}

function onNodeHoverEnd(): void {
  hoveredNodeId.value = null
}

const viewBox = computed(() => {
  const width = VIEW_BASE_WIDTH / zoom.value
  const height = VIEW_BASE_HEIGHT / zoom.value
  return `${cameraX.value - width / 2} ${cameraY.value - height / 2} ${width} ${height}`
})

const NODE_RADII: Record<SkillNodeKind, number> = {
  root: 28,
  minor: 15,
  notable: 21,
  keystone: 27,
}

const BRANCH_COLORS: Record<SkillNode['branch'], string> = {
  core: '#e2e8f0',
  offense: '#f87171',
  arsenal: '#fb923c',
  tech: '#22d3ee',
  defense: '#34d399',
  sensors: '#a78bfa',
  fortune: '#fbbf24',
}

type NodeState = 'unlocked' | 'available' | 'locked'

function stateOf({ nodeId }: { nodeId: string }): NodeState {
  if (metaStore.unlockedNodeIdSet.has(nodeId) === true) {
    return 'unlocked'
  }
  if (metaStore.availableNodeIdSet.has(nodeId) === true) {
    return 'available'
  }
  return 'locked'
}

const selectedNode = computed<SkillNode | null>(() => {
  if (selectedNodeId.value === null) {
    return null
  }
  return SKILL_NODES_BY_ID.get(selectedNodeId.value) ?? null
})

const selectedNodeState = computed<NodeState | null>(() => {
  if (selectedNodeId.value === null) {
    return null
  }
  return stateOf({ nodeId: selectedNodeId.value })
})

/** the selected node's price at the current paragon level */
const selectedNodeCost = computed<number>(() => {
  if (selectedNode.value === null) {
    return 0
  }
  return metaStore.nodeCostOf({ nodeId: selectedNode.value.id })
})

const unlockBlockReason = computed<string | null>(() => {
  if (selectedNode.value === null || selectedNodeState.value === null) {
    return null
  }
  if (selectedNodeState.value === 'unlocked') {
    return 'Already unlocked'
  }
  if (selectedNodeState.value === 'locked') {
    return 'Connect an adjacent node first'
  }
  if (metaStore.stardust < selectedNodeCost.value) {
    return `Need ${selectedNodeCost.value - Math.floor(metaStore.stardust)} more stardust`
  }
  return null
})

/* px of movement before a press counts as a pan instead of a click */
const DRAG_THRESHOLD_PX = 5

function onPointerDown(event: PointerEvent): void {
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (activePointers.size === 2) {
    const [first, second] = [...activePointers.values()]
    lastPinchDistance = Math.hypot(first.x - second.x, first.y - second.y)
    // a second finger means pinch — never a node tap
    isDraggingCamera = true
    svgElement.value?.setPointerCapture(event.pointerId)
  }
  if (activePointers.size === 1) {
    isDraggingCamera = false
  }
}

function onPointerMove(event: PointerEvent): void {
  const pointer = activePointers.get(event.pointerId)
  if (pointer === undefined || svgElement.value === null) {
    return
  }
  const clientWidth = svgElement.value.clientWidth
  if (clientWidth <= 0) {
    return
  }
  const unitsPerPixel = VIEW_BASE_WIDTH / zoom.value / clientWidth

  if (activePointers.size >= 2) {
    // pinch: zoom by the change in finger spread, pan by the midpoint drift
    const [first, second] = [...activePointers.values()]
    const oldMidX = (first.x + second.x) / 2
    const oldMidY = (first.y + second.y) / 2
    pointer.x = event.clientX
    pointer.y = event.clientY
    const distance = Math.hypot(first.x - second.x, first.y - second.y)
    if (lastPinchDistance > 0 && distance > 0) {
      zoom.value = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, zoom.value * (distance / lastPinchDistance)),
      )
    }
    lastPinchDistance = distance
    cameraX.value -= ((first.x + second.x) / 2 - oldMidX) * unitsPerPixel
    cameraY.value -= ((first.y + second.y) / 2 - oldMidY) * unitsPerPixel
    return
  }

  const movedX = event.clientX - pointer.x
  const movedY = event.clientY - pointer.y
  if (isDraggingCamera === false) {
    if (Math.hypot(movedX, movedY) < DRAG_THRESHOLD_PX) {
      return
    }
    // capturing only once a real drag starts keeps click events reaching the nodes
    isDraggingCamera = true
    svgElement.value.setPointerCapture(event.pointerId)
  }
  cameraX.value -= movedX * unitsPerPixel
  cameraY.value -= movedY * unitsPerPixel
  pointer.x = event.clientX
  pointer.y = event.clientY
}

function onPointerUp(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  lastPinchDistance = 0
  if (activePointers.size === 0) {
    isDraggingCamera = false
  }
}

function zoomBy({ factor }: { factor: number }): void {
  zoom.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom.value * factor))
}

function onWheel(event: WheelEvent): void {
  zoomBy({ factor: event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP })
}

function selectNode({ nodeId }: { nodeId: string }): void {
  selectedNodeId.value = nodeId
}

function unlockSelectedNode(): void {
  if (selectedNodeId.value === null) {
    return
  }
  metaStore.unlockNode({ nodeId: selectedNodeId.value })
}

function requestReset(): void {
  if (isConfirmingReset.value === false) {
    isConfirmingReset.value = true
    return
  }
  metaStore.resetTree()
  isConfirmingReset.value = false
  selectedNodeId.value = null
}

const isConfirmingPrestige = ref(false)

function requestPrestige(): void {
  if (isConfirmingPrestige.value === false) {
    isConfirmingPrestige.value = true
    return
  }
  metaStore.prestige()
  isConfirmingPrestige.value = false
  selectedNodeId.value = null
}

function edgeOpacity({ fromId, toId }: { fromId: string; toId: string }): number {
  const isFromUnlocked = metaStore.unlockedNodeIdSet.has(fromId)
  const isToUnlocked = metaStore.unlockedNodeIdSet.has(toId)
  if (isFromUnlocked === true && isToUnlocked === true) {
    return 0.9
  }
  if (isFromUnlocked === true || isToUnlocked === true) {
    return 0.45
  }
  return 0.15
}

function nodeFill({ node }: { node: SkillNode }): string {
  const state = stateOf({ nodeId: node.id })
  if (state === 'unlocked') {
    return BRANCH_COLORS[node.branch]
  }
  return '#0f172a'
}

function nodeStroke({ node }: { node: SkillNode }): string {
  const state = stateOf({ nodeId: node.id })
  if (state === 'locked') {
    return '#334155'
  }
  return BRANCH_COLORS[node.branch]
}

function nodeOpacity({ node }: { node: SkillNode }): number {
  return stateOf({ nodeId: node.id }) === 'locked' ? 0.5 : 1
}
</script>

<template>
  <main class="flex h-screen flex-col">
    <header
      class="z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-3"
    >
      <div class="flex items-center gap-6">
        <RouterLink
          to="/"
          class="text-sm font-semibold text-slate-400 transition hover:text-slate-200"
        >
          ← Home
        </RouterLink>
        <h1 class="text-xl font-black tracking-wider text-fuchsia-300">PARAGON TREE</h1>
      </div>
      <div class="flex items-center gap-4">
        <span
          v-if="metaStore.prestigeLevel > 0"
          class="flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sm font-bold text-sky-300"
          title="Each prestige pulls the view back and staffs another gun emplacement"
        >
          ⟴ Prestige {{ metaStore.prestigeLevel }}
        </span>
        <button
          v-if="metaStore.isParagonComplete === true"
          type="button"
          class="cursor-pointer rounded-lg border border-sky-400/50 bg-sky-500/15 px-3 py-1.5 text-sm font-bold text-sky-300 transition hover:bg-sky-500/25"
          @click="requestPrestige()"
          @mouseleave="isConfirmingPrestige = false"
        >
          {{
            isConfirmingPrestige === true
              ? 'Confirm: reset everything, zoom out?'
              : '⟴ Prestige — pull back the view'
          }}
        </button>
        <span
          class="flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-1.5 text-sm font-bold text-fuchsia-300"
          :title="`${metaStore.paragonLevel} of ${SKILL_NODES.length - 1} nodes bought`"
        >
          Paragon {{ metaStore.paragonLevel }}
        </span>
        <span
          class="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 font-bold text-amber-300"
        >
          ✦ {{ Math.floor(metaStore.stardust) }}
        </span>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-red-500/40 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
          @click="requestReset()"
          @mouseleave="isConfirmingReset = false"
        >
          {{ isConfirmingReset === true ? 'Confirm full refund?' : 'Reset Tree' }}
        </button>
      </div>
    </header>

    <div class="relative flex-1 overflow-hidden">
      <svg
        ref="svgElement"
        class="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        :viewBox="viewBox"
        @pointerdown="(event) => onPointerDown(event)"
        @pointermove="(event) => onPointerMove(event)"
        @pointerup="(event) => onPointerUp(event)"
        @pointercancel="(event) => onPointerUp(event)"
        @wheel.prevent="(event) => onWheel(event)"
      >
        <line
          v-for="[fromId, toId] in SKILL_EDGES"
          :key="`${fromId}-${toId}`"
          :x1="SKILL_NODES_BY_ID.get(fromId)?.x ?? 0"
          :y1="SKILL_NODES_BY_ID.get(fromId)?.y ?? 0"
          :x2="SKILL_NODES_BY_ID.get(toId)?.x ?? 0"
          :y2="SKILL_NODES_BY_ID.get(toId)?.y ?? 0"
          stroke="#64748b"
          stroke-width="3"
          :opacity="edgeOpacity({ fromId, toId })"
        />

        <g
          v-for="node in SKILL_NODES"
          :key="node.id"
          class="cursor-pointer"
          :opacity="nodeOpacity({ node })"
          @click="selectNode({ nodeId: node.id })"
          @pointerenter="(event) => onNodeHover({ nodeId: node.id, event })"
          @pointermove="(event) => onNodeHover({ nodeId: node.id, event })"
          @pointerleave="onNodeHoverEnd()"
        >
          <circle
            v-if="selectedNodeId === node.id"
            :cx="node.x"
            :cy="node.y"
            :r="NODE_RADII[node.kind] + 8"
            fill="none"
            stroke="#f0abfc"
            stroke-width="2"
            stroke-dasharray="6 4"
          />
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="NODE_RADII[node.kind]"
            :fill="nodeFill({ node })"
            :stroke="nodeStroke({ node })"
            :stroke-width="node.kind === 'keystone' ? 4 : 3"
          />
          <text
            :x="node.x"
            :y="node.y + NODE_RADII[node.kind] + 18"
            text-anchor="middle"
            class="pointer-events-none select-none"
            fill="#cbd5e1"
            font-size="13"
            font-weight="600"
          >
            {{ node.name }}
          </text>
        </g>
      </svg>

      <div
        v-if="hoveredNode !== null"
        class="pointer-events-none absolute z-20 w-72 rounded-xl border border-slate-600 bg-slate-900/95 p-4 shadow-xl"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="font-bold" :style="{ color: BRANCH_COLORS[hoveredNode.branch] }">
            {{ hoveredNode.name }}
          </p>
          <span
            class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400"
          >
            {{ hoveredNode.kind }}
          </span>
        </div>
        <p class="mt-1.5 text-sm text-slate-300">{{ hoveredNode.description }}</p>
        <div class="mt-2 flex items-center justify-between text-xs">
          <span v-if="hoveredNode.cost > 0" class="font-semibold text-amber-300">
            ✦ {{ metaStore.nodeCostOf({ nodeId: hoveredNode.id }) }}
          </span>
          <span
            :class="{
              'text-emerald-400': stateOf({ nodeId: hoveredNode.id }) === 'unlocked',
              'text-sky-300': stateOf({ nodeId: hoveredNode.id }) === 'available',
              'text-slate-500': stateOf({ nodeId: hoveredNode.id }) === 'locked',
            }"
          >
            {{
              stateOf({ nodeId: hoveredNode.id }) === 'unlocked'
                ? 'Unlocked ✓'
                : stateOf({ nodeId: hoveredNode.id }) === 'available'
                  ? 'Click to inspect, unlock below'
                  : 'Locked — connect an adjacent node'
            }}
          </span>
        </div>
      </div>

      <aside
        v-if="selectedNode !== null"
        class="absolute bottom-4 right-4 z-10 flex w-80 flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 p-5"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold" :style="{ color: BRANCH_COLORS[selectedNode.branch] }">
            {{ selectedNode.name }}
          </h2>
          <span
            class="rounded bg-slate-800 px-2 py-0.5 text-xs uppercase tracking-wider text-slate-400"
          >
            {{ selectedNode.kind }}
          </span>
        </div>
        <p class="text-sm text-slate-300">{{ selectedNode.description }}</p>
        <p v-if="selectedNode.cost > 0" class="text-sm font-semibold text-amber-300">
          Cost: ✦ {{ selectedNodeCost }}
        </p>
        <button
          v-if="selectedNodeState !== 'unlocked'"
          type="button"
          class="cursor-pointer rounded-xl bg-fuchsia-500 px-5 py-2.5 font-bold text-slate-950 transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          :disabled="unlockBlockReason !== null"
          @click="unlockSelectedNode()"
        >
          {{ unlockBlockReason ?? 'Unlock' }}
        </button>
        <p v-else class="text-center text-sm font-semibold text-emerald-400">Unlocked ✓</p>
      </aside>

      <div class="absolute bottom-4 left-4 flex items-center gap-3">
        <div class="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900/90">
          <button
            type="button"
            class="cursor-pointer px-3.5 py-2 text-lg font-bold leading-none text-slate-300 transition hover:bg-slate-800"
            aria-label="Zoom out"
            @click="zoomBy({ factor: 1 / ZOOM_STEP })"
          >
            −
          </button>
          <button
            type="button"
            class="cursor-pointer border-l border-slate-700 px-3.5 py-2 text-lg font-bold leading-none text-slate-300 transition hover:bg-slate-800"
            aria-label="Zoom in"
            @click="zoomBy({ factor: ZOOM_STEP })"
          >
            +
          </button>
        </div>
        <p class="pointer-events-none text-xs text-slate-500">
          Drag to pan · scroll or pinch to zoom · tap a node for details
        </p>
      </div>
    </div>
  </main>
</template>
