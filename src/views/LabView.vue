<script setup lang="ts">
import type Phaser from 'phaser'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { createPlanetGame } from '@/game/createGame'
import { SOURCE_LABELS } from '@/game/data/sourceLabels'
import {
  describeSynergyRequirements,
  UPGRADE_DEFINITIONS,
  type UpgradeDefinition,
} from '@/game/data/upgrades'
import { gameEventBus } from '@/game/eventBus'
import { soundEngine } from '@/game/sound'
import type { SandboxLayout, SandboxStatsEntry } from '@/game/types'
import { SKILL_NODES, applyPrestige, buildStartingStats } from '@/skills/skillTree'

type TreePreset = 'none' | 'keystones' | 'full'

const gameContainer = ref<HTMLDivElement | null>(null)
const treePreset = ref<TreePreset>('none')
const isMuted = ref(soundEngine.muted())

function toggleMute(): void {
  isMuted.value = isMuted.value === false
  soundEngine.setMuted({ isMuted: isMuted.value })
}
const cardStacks = ref<Record<string, number>>({})
const statsEntries = ref<Array<SandboxStatsEntry>>([])
const elapsedMs = ref(0)
const dummyFormation = ref<SandboxLayout['formation']>('field')
const dummySpread = ref(100)
const dummiesMoving = ref(false)
const isMainGunEnabled = ref(true)
/** null = invincible; finite dummies die and respawn (for kill-triggered effects) */
const dummyHp = ref<number | null>(null)
const DUMMY_HP_OPTIONS: Array<number | null> = [null, 50, 250, 1000]
/** 0.5× slow-mo for inspecting visuals, fast-forward for letting DPS converge */
const SPEED_OPTIONS: Array<number> = [0.5, 1, 2, 5]
const speedMultiplier = ref(1)
/** simulate prestige zoom-out: wider arena, extra gun emplacements */
const PRESTIGE_OPTIONS: Array<number> = [0, 3, 6, 9]
const prestigeLevel = ref(0)

function setPrestige({ level }: { level: number }): void {
  prestigeLevel.value = level
  scheduleRestart()
}

/** force a cannon count (same arena) — isolates per-gun value for balance work */
const CANNON_OPTIONS: Array<number | null> = [null, 1, 2, 3, 4]
const cannonOverride = ref<number | null>(null)

function setCannons({ count }: { count: number | null }): void {
  cannonOverride.value = count
  scheduleRestart()
}

function setSpeed({ multiplier }: { multiplier: number }): void {
  speedMultiplier.value = multiplier
  gameEventBus.emit({ event: 'set-speed', payload: { multiplier } })
}

let game: Phaser.Game | null = null
let restartTimer: ReturnType<typeof setTimeout> | null = null
const busUnsubscribes: Array<() => void> = []

const PRESET_NODE_IDS: Record<TreePreset, Array<string>> = {
  none: ['core'],
  keystones: [
    'core',
    ...SKILL_NODES.filter((node) => node.kind === 'keystone' || node.id.endsWith('-expansion')).map(
      (node) => node.id,
    ),
  ],
  full: SKILL_NODES.map((node) => node.id),
}

const totalDps = computed(() => statsEntries.value.reduce((sum, entry) => sum + entry.dps, 0))

// ── card tooltip ──────────────────────────────────────────────────────
const mainElement = ref<HTMLElement | null>(null)
const hoveredCard = ref<UpgradeDefinition | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

const hoveredSynergyOf = computed(() => {
  if (hoveredCard.value === null) {
    return null
  }
  return describeSynergyRequirements({ definition: hoveredCard.value })
})

function onCardHover({
  definition,
  event,
}: {
  definition: UpgradeDefinition
  event: PointerEvent
}): void {
  hoveredCard.value = definition
  const bounds = mainElement.value?.getBoundingClientRect()
  if (bounds === undefined) {
    return
  }
  tooltipX.value = Math.min(event.clientX - bounds.left + 16, bounds.width - 310)
  tooltipY.value = Math.min(event.clientY - bounds.top + 16, bounds.height - 130)
}

function onCardHoverEnd(): void {
  hoveredCard.value = null
}

const weaponDefinitions = UPGRADE_DEFINITIONS.filter(
  (definition) => definition.category === 'weapon',
)
const tacticDefinitions = UPGRADE_DEFINITIONS.filter(
  (definition) => definition.category === 'tactic',
)

function buildSandboxStats() {
  const stats = buildStartingStats({ unlockedNodeIds: PRESET_NODE_IDS[treePreset.value] })
  let finalStats = stats
  for (const definition of UPGRADE_DEFINITIONS) {
    const stacks = cardStacks.value[definition.id] ?? 0
    for (let index = 0; index < stacks; index += 1) {
      finalStats = definition.apply(finalStats)
    }
  }
  return finalStats
}

function startGame(): void {
  if (gameContainer.value === null) {
    return
  }
  game = createPlanetGame({
    parent: gameContainer.value,
    sceneData: {
      startingStats: {
        ...applyPrestige({ stats: buildSandboxStats(), prestigeLevel: prestigeLevel.value }),
        ...(cannonOverride.value !== null ? { cannonCount: cannonOverride.value } : {}),
      },
      stardustMultiplier: 1,
      mode: 'sandbox',
      prestigeLevel: prestigeLevel.value,
      initialCardStacks: { ...cardStacks.value },
      sandboxLayout: {
        formation: dummyFormation.value,
        spread: dummySpread.value / 100,
        isMoving: dummiesMoving.value,
        isMainGunEnabled: isMainGunEnabled.value,
        dummyHp: dummyHp.value,
      },
    },
  })
  // a fresh scene boots at 1× — re-apply the chosen speed once it is listening
  // (same readiness window the benchmark relies on)
  if (speedMultiplier.value !== 1) {
    setTimeout(() => {
      gameEventBus.emit({ event: 'set-speed', payload: { multiplier: speedMultiplier.value } })
    }, 600)
  }
}

function setFormation({ formation }: { formation: SandboxLayout['formation'] }): void {
  dummyFormation.value = formation
  scheduleRestart()
}

function toggleMotion(): void {
  dummiesMoving.value = dummiesMoving.value === false
  scheduleRestart()
}

function toggleMainGun(): void {
  isMainGunEnabled.value = isMainGunEnabled.value === false
  scheduleRestart()
}

function setDummyHp({ hp }: { hp: number | null }): void {
  dummyHp.value = hp
  scheduleRestart()
}

function onSpreadInput(): void {
  scheduleRestart()
}

function destroyGame(): void {
  if (game !== null) {
    game.destroy(true)
    game = null
  }
}

function restartNow(): void {
  statsEntries.value = []
  elapsedMs.value = 0
  destroyGame()
  startGame()
}

/** any config change rebuilds the range so stats and visuals stay exact */
function scheduleRestart(): void {
  if (restartTimer !== null) {
    clearTimeout(restartTimer)
  }
  restartTimer = setTimeout(() => {
    restartTimer = null
    restartNow()
  }, 350)
}

function adjustCard({ cardId, step }: { cardId: string; step: number }): void {
  const definition = UPGRADE_DEFINITIONS.find((candidate) => candidate.id === cardId)
  if (definition === undefined) {
    return
  }
  const current = cardStacks.value[cardId] ?? 0
  // allow up to +2 over base cap to simulate the paragon tier nodes
  const next = Math.max(0, Math.min(definition.maxStacks + 2, current + step))
  cardStacks.value = { ...cardStacks.value, [cardId]: next }
  scheduleRestart()
}

function setPreset({ preset }: { preset: TreePreset }): void {
  treePreset.value = preset
  scheduleRestart()
}

function resetAll(): void {
  cardStacks.value = {}
  treePreset.value = 'none'
  scheduleRestart()
}

// ── automated benchmark ───────────────────────────────────────────────

interface BenchmarkRow {
  cardId: string
  name: string
  tier1Dps: number | null
  tier5Dps: number | null
}

/** damage-dealing weapons only — cc/utility (lockdown, cloud, nanite, mines) need moving targets */
const BENCHMARK_TARGETS: Array<{ cardId: string; source: string }> = [
  { cardId: 'salvo', source: 'main' },
  { cardId: 'flak', source: 'flak' },
  { cardId: 'flame', source: 'flame' },
  { cardId: 'devourer', source: 'devourer' },
  { cardId: 'rocket', source: 'rocket' },
  { cardId: 'chain', source: 'chain' },
  { cardId: 'nova', source: 'nova' },
  { cardId: 'railgun', source: 'railgun' },
  { cardId: 'lance', source: 'lance' },
  { cardId: 'airstrike', source: 'airstrike' },
  { cardId: 'bfg', source: 'bfg' },
  { cardId: 'orbital-laser', source: 'orbital-laser' },
  // proximity mines only score against moving targets
  { cardId: 'mines', source: 'mines' },
]

const BENCHMARK_WINDOW_MS = 45_000
const isBenchmarking = ref(false)
const benchmarkStatus = ref('')
const benchmarkRows = ref<Array<BenchmarkRow>>([])

function sleep({ ms }: { ms: number }): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

/** configure + fast-forward are both synchronous bus calls — no timers, no throttling */
function measure({ cardId, tier }: { cardId: string; tier: number }): number | null {
  cardStacks.value = { [cardId]: tier }
  gameEventBus.emit({
    event: 'sandbox-configure',
    payload: {
      stats: buildSandboxStats(),
      cardStacks: { ...cardStacks.value },
      layout: {
        formation: dummyFormation.value,
        spread: dummySpread.value / 100,
        isMoving: dummiesMoving.value,
        // the salvo row measures the 'main' source — the gun must fire here
        isMainGunEnabled: true,
        // benchmarks need steady targets
        dummyHp: null,
      },
    },
  })
  gameEventBus.emit({ event: 'sandbox-fastforward', payload: { gameMs: BENCHMARK_WINDOW_MS } })
  if (elapsedMs.value < BENCHMARK_WINDOW_MS) {
    return null
  }
  const source = BENCHMARK_TARGETS.find((target) => target.cardId === cardId)?.source ?? cardId
  const entry = statsEntries.value.find((candidate) => candidate.source === source)
  return entry?.dps ?? 0
}

async function runBenchmark(): Promise<void> {
  if (isBenchmarking.value === true) {
    return
  }
  isBenchmarking.value = true
  benchmarkRows.value = []
  treePreset.value = 'none'

  // brief initial wait so the sandbox scene exists before configure events fire
  await sleep({ ms: 600 })

  for (const target of BENCHMARK_TARGETS) {
    const definition = UPGRADE_DEFINITIONS.find((candidate) => candidate.id === target.cardId)
    const row: BenchmarkRow = {
      cardId: target.cardId,
      name: definition?.name ?? target.cardId,
      tier1Dps: null,
      tier5Dps: null,
    }
    benchmarkStatus.value = `${row.name}…`
    row.tier1Dps = measure({ cardId: target.cardId, tier: 1 })
    row.tier5Dps = measure({ cardId: target.cardId, tier: 5 })
    benchmarkRows.value = [...benchmarkRows.value, row]
    if (row.tier1Dps === null && row.tier5Dps === null) {
      benchmarkStatus.value = 'Aborted — the range scene is not responding'
      isBenchmarking.value = false
      return
    }
    // yield a frame so the table paints between rows
    await sleep({ ms: 10 })
  }

  benchmarkStatus.value = 'Done'
  cardStacks.value = {}
  restartNow()
  isBenchmarking.value = false
}

onMounted(() => {
  busUnsubscribes.push(
    gameEventBus.on({
      event: 'sandbox-stats',
      handler: (payload) => {
        statsEntries.value = payload.entries
        elapsedMs.value = payload.elapsedMs
      },
    }),
  )
  startGame()
})

onUnmounted(() => {
  destroyGame()
  for (const unsubscribe of busUnsubscribes) {
    unsubscribe()
  }
})
</script>

<template>
  <main ref="mainElement" class="relative flex h-screen">
    <aside
      class="z-10 flex w-104 flex-col gap-3 overflow-y-auto border-r border-slate-800 bg-slate-950/95 p-4"
    >
      <div class="flex items-center justify-between">
        <RouterLink to="/" class="text-sm font-semibold text-slate-400 hover:text-slate-200">
          ← Home
        </RouterLink>
        <span class="flex items-center gap-2">
          <h1 class="text-sm font-black tracking-widest text-lime-300">TRAINING RANGE</h1>
          <button
            type="button"
            class="cursor-pointer rounded px-1 text-sm"
            :aria-label="isMuted === true ? 'Unmute sound' : 'Mute sound'"
            @click="toggleMute()"
          >
            {{ isMuted === true ? '🔇' : '🔊' }}
          </button>
        </span>
      </div>

      <!-- ── setup: presets, targets, motion ──────────────────────── -->
      <div class="flex flex-col gap-2 rounded-xl bg-slate-900/50 p-2.5">
        <div class="flex items-center gap-1.5">
          <p class="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Paragon
          </p>
          <button
            v-for="preset in ['none', 'keystones', 'full'] as Array<TreePreset>"
            :key="preset"
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition"
            :class="
              treePreset === preset
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="setPreset({ preset })"
          >
            {{ preset }}
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <p class="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Targets
          </p>
          <button
            v-for="formation in ['field', 'boss'] as Array<SandboxLayout['formation']>"
            :key="formation"
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition"
            :class="
              dummyFormation === formation
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="setFormation({ formation })"
          >
            {{ formation === 'field' ? 'Target field' : 'Single boss' }}
          </button>
        </div>

        <div class="flex items-center gap-1.5" data-testid="dummy-motion">
          <p class="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Motion
          </p>
          <button
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition"
            :class="
              dummiesMoving === false
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="dummiesMoving === true && toggleMotion()"
          >
            Static
          </button>
          <button
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition"
            :class="
              dummiesMoving === true
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="dummiesMoving === false && toggleMotion()"
          >
            Moving
          </button>
        </div>

        <div class="flex items-center gap-1.5" data-testid="main-gun-toggle">
          <p class="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Main gun
          </p>
          <button
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition"
            :class="
              isMainGunEnabled === true
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="isMainGunEnabled === false && toggleMainGun()"
          >
            Firing
          </button>
          <button
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition"
            :class="
              isMainGunEnabled === false
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="isMainGunEnabled === true && toggleMainGun()"
          >
            Silenced
          </button>
        </div>

        <div class="flex items-center gap-1.5" data-testid="dummy-hp">
          <p class="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Dummy HP
          </p>
          <button
            v-for="option in DUMMY_HP_OPTIONS"
            :key="option ?? 'invincible'"
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition"
            :class="
              dummyHp === option
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="setDummyHp({ hp: option })"
          >
            {{ option === null ? '∞' : option }}
          </button>
        </div>

        <div class="flex items-center gap-1.5" data-testid="sim-cannons">
          <p class="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Guns
          </p>
          <button
            v-for="option in CANNON_OPTIONS"
            :key="option ?? 'auto'"
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition"
            :class="
              cannonOverride === option
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="setCannons({ count: option })"
          >
            {{ option ?? 'auto' }}
          </button>
        </div>

        <div class="flex items-center gap-1.5" data-testid="sim-prestige">
          <p class="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Prestige
          </p>
          <button
            v-for="option in PRESTIGE_OPTIONS"
            :key="option"
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition"
            :class="
              prestigeLevel === option
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="setPrestige({ level: option })"
          >
            ⟴{{ option }}
          </button>
        </div>

        <div class="flex items-center gap-1.5" data-testid="sim-speed">
          <p class="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Speed
          </p>
          <button
            v-for="option in SPEED_OPTIONS"
            :key="option"
            type="button"
            class="flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold transition"
            :class="
              speedMultiplier === option
                ? 'bg-lime-400 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            "
            @click="setSpeed({ multiplier: option })"
          >
            ×{{ option }}
          </button>
        </div>

        <label
          v-if="dummyFormation === 'field'"
          class="flex items-center gap-2 text-xs text-slate-400"
        >
          <span class="w-16 shrink-0 font-bold uppercase tracking-wider text-slate-500">
            Spread
          </span>
          <input
            v-model.number="dummySpread"
            type="range"
            min="30"
            max="160"
            step="10"
            class="flex-1 accent-lime-400"
            @change="onSpreadInput()"
          />
          <span class="w-9 text-right font-bold text-slate-200">{{ dummySpread }}%</span>
        </label>
      </div>

      <!-- ── live dps ─────────────────────────────────────────────── -->
      <div class="flex flex-col gap-1">
        <p
          class="flex items-baseline justify-between text-xs font-bold uppercase tracking-wider text-slate-500"
        >
          DPS ({{ (elapsedMs / 1000).toFixed(0) }}s)
          <span class="text-sm normal-case tracking-normal text-lime-300">
            Σ {{ totalDps.toFixed(1) }}
          </span>
        </p>
        <div class="grid grid-cols-2 gap-1">
          <div
            v-for="entry in statsEntries"
            :key="entry.source"
            class="flex items-center justify-between rounded bg-slate-900/70 px-2 py-1 text-xs"
          >
            <span class="truncate text-slate-300">
              {{ SOURCE_LABELS[entry.source] ?? entry.source }}
            </span>
            <span class="font-bold text-slate-100">{{ entry.dps.toFixed(1) }}</span>
          </div>
        </div>
        <p v-if="statsEntries.length === 0" class="text-xs text-slate-600">
          Add cards to start measuring…
        </p>
      </div>

      <!-- ── cards ────────────────────────────────────────────────── -->
      <div class="flex flex-col gap-1">
        <p class="flex items-baseline justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Weapons</span>
          <button
            type="button"
            class="cursor-pointer text-xs font-semibold text-red-400 hover:text-red-300"
            @click="resetAll()"
          >
            Reset everything
          </button>
        </p>
        <div class="grid grid-cols-2 gap-1">
          <div
            v-for="definition in weaponDefinitions"
            :key="definition.id"
            class="flex items-center justify-between gap-1 rounded-lg bg-slate-900/70 px-2 py-1"
            @pointerenter="(event) => onCardHover({ definition, event })"
            @pointermove="(event) => onCardHover({ definition, event })"
            @pointerleave="onCardHoverEnd()"
          >
            <span class="truncate text-xs font-semibold text-slate-200">
              {{ definition.name }}
            </span>
            <span class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="h-5 w-5 cursor-pointer rounded bg-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-600"
                @click="adjustCard({ cardId: definition.id, step: -1 })"
              >
                −
              </button>
              <span class="w-4 text-center text-xs font-bold text-amber-300">
                {{ cardStacks[definition.id] ?? 0 }}
              </span>
              <button
                type="button"
                class="h-5 w-5 cursor-pointer rounded bg-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-600"
                @click="adjustCard({ cardId: definition.id, step: 1 })"
              >
                +
              </button>
            </span>
          </div>
        </div>

        <p class="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          Synergy tactics
        </p>
        <div class="grid grid-cols-2 gap-1">
          <div
            v-for="definition in tacticDefinitions"
            :key="definition.id"
            class="flex items-center justify-between gap-1 rounded-lg bg-slate-900/70 px-2 py-1"
            @pointerenter="(event) => onCardHover({ definition, event })"
            @pointermove="(event) => onCardHover({ definition, event })"
            @pointerleave="onCardHoverEnd()"
          >
            <span class="truncate text-xs font-semibold text-slate-200">
              {{ definition.name }}
            </span>
            <span class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="h-5 w-5 cursor-pointer rounded bg-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-600"
                @click="adjustCard({ cardId: definition.id, step: -1 })"
              >
                −
              </button>
              <span class="w-4 text-center text-xs font-bold text-amber-300">
                {{ cardStacks[definition.id] ?? 0 }}
              </span>
              <button
                type="button"
                class="h-5 w-5 cursor-pointer rounded bg-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-600"
                @click="adjustCard({ cardId: definition.id, step: 1 })"
              >
                +
              </button>
            </span>
          </div>
        </div>
      </div>

      <!-- ── benchmark ────────────────────────────────────────────── -->
      <div class="flex flex-col gap-1.5">
        <button
          type="button"
          class="cursor-pointer rounded-lg bg-lime-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          :disabled="isBenchmarking === true"
          data-testid="run-benchmark"
          @click="runBenchmark()"
        >
          {{ isBenchmarking === true ? benchmarkStatus : 'Run benchmark (★1 vs ★5)' }}
        </button>
        <p v-if="isBenchmarking === false && benchmarkStatus !== ''" class="text-xs text-slate-500">
          {{ benchmarkStatus }}
        </p>
        <table v-if="benchmarkRows.length > 0" class="w-full text-xs" data-testid="benchmark-table">
          <thead>
            <tr class="text-left text-slate-500">
              <th class="py-0.5 font-semibold">Weapon</th>
              <th class="py-0.5 text-right font-semibold">★1</th>
              <th class="py-0.5 text-right font-semibold">★5</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in benchmarkRows" :key="row.cardId" class="border-t border-slate-800">
              <td class="py-0.5 text-slate-300">{{ row.name }}</td>
              <td class="py-0.5 text-right font-bold text-slate-100">
                {{ row.tier1Dps === null ? '—' : row.tier1Dps.toFixed(1) }}
              </td>
              <td class="py-0.5 text-right font-bold text-amber-300">
                {{ row.tier5Dps === null ? '—' : row.tier5Dps.toFixed(1) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </aside>

    <div class="relative flex-1">
      <div ref="gameContainer" class="h-full w-full overflow-hidden" />
    </div>

    <div
      v-if="hoveredCard !== null"
      class="pointer-events-none absolute z-30 w-72 rounded-lg border border-slate-700 bg-slate-950/95 p-3 shadow-xl"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
      data-testid="card-tooltip"
    >
      <p class="flex items-baseline justify-between gap-2">
        <span class="text-sm font-bold text-slate-100">{{ hoveredCard.name }}</span>
        <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {{ hoveredCard.rarity }} {{ hoveredCard.category }}
        </span>
      </p>
      <p class="mt-1 text-xs leading-relaxed text-slate-300">{{ hoveredCard.description }}</p>
      <p v-if="hoveredSynergyOf !== null" class="mt-1.5 text-xs font-semibold text-fuchsia-300">
        ⛓ Synergy of {{ hoveredSynergyOf }}
      </p>
    </div>
  </main>
</template>
